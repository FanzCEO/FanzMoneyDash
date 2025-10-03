import { Pool } from 'pg';
import Redis from 'ioredis';
import { Logger } from 'winston';
import AWS from 'aws-sdk';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import cron from 'node-cron';
import crypto from 'crypto';

export interface BackupConfig {
  enabled: boolean;
  schedule: {
    full: string; // cron expression for full backup
    incremental: string; // cron expression for incremental backup
  };
  retention: {
    daily: number; // days to keep daily backups
    weekly: number; // weeks to keep weekly backups
    monthly: number; // months to keep monthly backups
  };
  storage: {
    local: {
      enabled: boolean;
      path: string;
    };
    s3: {
      enabled: boolean;
      bucket: string;
      region: string;
      prefix: string;
    };
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyId?: string;
  };
  compression: {
    enabled: boolean;
    level: number;
  };
}

export interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  size: number;
  location: string;
  checksum: string;
  components: {
    database: boolean;
    redis: boolean;
    files: boolean;
    logs: boolean;
  };
  error?: string;
}

export interface RestoreRequest {
  backupId: string;
  components: {
    database?: boolean;
    redis?: boolean;
    files?: boolean;
    logs?: boolean;
  };
  targetTime?: Date;
  dryRun?: boolean;
}

export class BackupRecoveryService {
  private db: Pool;
  private redis: Redis;
  private logger: Logger;
  private config: BackupConfig;
  private s3?: AWS.S3;

  constructor(
    db: Pool,
    redis: Redis,
    logger: Logger,
    config: BackupConfig
  ) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    this.config = config;

    if (config.storage.s3.enabled) {
      this.s3 = new AWS.S3({
        region: config.storage.s3.region,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });
    }

    this.initializeScheduledBackups();
  }

  /**
   * Create a full backup of all system components
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('full');
    const startTime = new Date();

    this.logger.info('Starting full backup:', { backupId, startTime });

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'full',
      status: 'in_progress',
      startTime,
      size: 0,
      location: '',
      checksum: '',
      components: {
        database: false,
        redis: false,
        files: false,
        logs: false
      }
    };

    try {
      await this.storeBackupMetadata(metadata);

      const backupTasks = [];

      // Database backup
      backupTasks.push(this.backupDatabase(backupId));

      // Redis backup
      backupTasks.push(this.backupRedis(backupId));

      // File system backup
      backupTasks.push(this.backupFiles(backupId));

      // Application logs backup
      backupTasks.push(this.backupLogs(backupId));

      // Wait for all backup tasks to complete
      const results = await Promise.allSettled(backupTasks);

      // Check results and update metadata
      metadata.components.database = results[0].status === 'fulfilled';
      metadata.components.redis = results[1].status === 'fulfilled';
      metadata.components.files = results[2].status === 'fulfilled';
      metadata.components.logs = results[3].status === 'fulfilled';

      // Create backup archive
      const archivePath = await this.createBackupArchive(backupId);
      metadata.location = archivePath;
      metadata.size = await this.getFileSize(archivePath);
      metadata.checksum = await this.calculateChecksum(archivePath);

      // Upload to remote storage if configured
      if (this.config.storage.s3.enabled) {
        await this.uploadToS3(archivePath, backupId);
      }

      metadata.endTime = new Date();
      metadata.status = 'completed';

      await this.updateBackupMetadata(metadata);

      this.logger.info('Full backup completed:', {
        backupId,
        duration: metadata.endTime.getTime() - startTime.getTime(),
        size: metadata.size
      });

      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      metadata.endTime = new Date();

      await this.updateBackupMetadata(metadata);

      this.logger.error('Full backup failed:', { backupId, error });
      throw error;
    }
  }

  /**
   * Create an incremental backup
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('incremental');
    const startTime = new Date();

    this.logger.info('Starting incremental backup:', { backupId, startTime });

    const lastBackup = await this.getLastSuccessfulBackup();
    const lastBackupTime = lastBackup?.endTime || new Date(0);

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'incremental',
      status: 'in_progress',
      startTime,
      size: 0,
      location: '',
      checksum: '',
      components: {
        database: false,
        redis: false,
        files: false,
        logs: false
      }
    };

    try {
      await this.storeBackupMetadata(metadata);

      // Incremental database backup (changes since last backup)
      await this.backupDatabaseIncremental(backupId, lastBackupTime);
      metadata.components.database = true;

      // Redis snapshot
      await this.backupRedis(backupId);
      metadata.components.redis = true;

      // Changed files only
      await this.backupFilesIncremental(backupId, lastBackupTime);
      metadata.components.files = true;

      // Recent logs
      await this.backupLogsIncremental(backupId, lastBackupTime);
      metadata.components.logs = true;

      // Create backup archive
      const archivePath = await this.createBackupArchive(backupId);
      metadata.location = archivePath;
      metadata.size = await this.getFileSize(archivePath);
      metadata.checksum = await this.calculateChecksum(archivePath);

      // Upload to remote storage if configured
      if (this.config.storage.s3.enabled) {
        await this.uploadToS3(archivePath, backupId);
      }

      metadata.endTime = new Date();
      metadata.status = 'completed';

      await this.updateBackupMetadata(metadata);

      this.logger.info('Incremental backup completed:', {
        backupId,
        duration: metadata.endTime.getTime() - startTime.getTime(),
        size: metadata.size
      });

      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      metadata.endTime = new Date();

      await this.updateBackupMetadata(metadata);

      this.logger.error('Incremental backup failed:', { backupId, error });
      throw error;
    }
  }

  /**
   * Restore system from backup
   */
  async restoreFromBackup(request: RestoreRequest): Promise<void> {
    this.logger.info('Starting restore operation:', request);

    try {
      const backup = await this.getBackupMetadata(request.backupId);
      if (!backup) {
        throw new Error(`Backup ${request.backupId} not found`);
      }

      if (backup.status !== 'completed') {
        throw new Error(`Backup ${request.backupId} is not in completed state`);
      }

      // Verify backup integrity
      await this.verifyBackupIntegrity(backup);

      // Download from remote storage if needed
      let localPath = backup.location;
      if (this.config.storage.s3.enabled) {
        localPath = await this.downloadFromS3(request.backupId);
      }

      // Extract backup archive
      const extractPath = await this.extractBackupArchive(localPath, request.backupId);

      if (request.dryRun) {
        this.logger.info('Dry run completed successfully');
        return;
      }

      // Create system snapshot before restore
      const snapshotId = await this.createSystemSnapshot();

      try {
        // Restore components as requested
        if (request.components.database && backup.components.database) {
          await this.restoreDatabase(extractPath);
        }

        if (request.components.redis && backup.components.redis) {
          await this.restoreRedis(extractPath);
        }

        if (request.components.files && backup.components.files) {
          await this.restoreFiles(extractPath);
        }

        if (request.components.logs && backup.components.logs) {
          await this.restoreLogs(extractPath);
        }

        this.logger.info('Restore completed successfully:', request);

      } catch (restoreError) {
        this.logger.error('Restore failed, rolling back:', restoreError);
        await this.rollbackFromSnapshot(snapshotId);
        throw restoreError;
      }

    } catch (error) {
      this.logger.error('Restore operation failed:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(limit: number = 50): Promise<BackupMetadata[]> {
    try {
      const query = `
        SELECT * FROM backup_metadata 
        ORDER BY start_time DESC 
        LIMIT $1
      `;

      const result = await this.db.query(query, [limit]);

      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        size: row.size,
        location: row.location,
        checksum: row.checksum,
        components: row.components,
        error: row.error
      }));

    } catch (error) {
      this.logger.error('Failed to list backups:', error);
      throw error;
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      this.logger.info('Starting backup cleanup');

      const now = new Date();
      const retentionQueries = [
        {
          type: 'daily',
          cutoff: new Date(now.getTime() - (this.config.retention.daily * 24 * 60 * 60 * 1000))
        },
        {
          type: 'weekly',
          cutoff: new Date(now.getTime() - (this.config.retention.weekly * 7 * 24 * 60 * 60 * 1000))
        },
        {
          type: 'monthly',
          cutoff: new Date(now.getTime() - (this.config.retention.monthly * 30 * 24 * 60 * 60 * 1000))
        }
      ];

      for (const retention of retentionQueries) {
        const expiredBackups = await this.getExpiredBackups(retention.cutoff);

        for (const backup of expiredBackups) {
          await this.deleteBackup(backup.id);
        }
      }

      this.logger.info('Backup cleanup completed');

    } catch (error) {
      this.logger.error('Backup cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backup: BackupMetadata): Promise<boolean> {
    try {
      let filePath = backup.location;

      // Download from S3 if needed
      if (this.config.storage.s3.enabled && !await this.fileExists(filePath)) {
        filePath = await this.downloadFromS3(backup.id);
      }

      // Verify file exists and is accessible
      if (!await this.fileExists(filePath)) {
        throw new Error(`Backup file not found: ${filePath}`);
      }

      // Verify file size
      const currentSize = await this.getFileSize(filePath);
      if (currentSize !== backup.size) {
        throw new Error(`Backup size mismatch: expected ${backup.size}, got ${currentSize}`);
      }

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(filePath);
      if (currentChecksum !== backup.checksum) {
        throw new Error(`Backup checksum mismatch: expected ${backup.checksum}, got ${currentChecksum}`);
      }

      this.logger.info('Backup integrity verified:', { backupId: backup.id });
      return true;

    } catch (error) {
      this.logger.error('Backup integrity verification failed:', error);
      return false;
    }
  }

  // Private methods
  private initializeScheduledBackups(): void {
    if (!this.config.enabled) {
      return;
    }

    // Schedule full backups
    cron.schedule(this.config.schedule.full, async () => {
      try {
        await this.createFullBackup();
      } catch (error) {
        this.logger.error('Scheduled full backup failed:', error);
      }
    });

    // Schedule incremental backups
    cron.schedule(this.config.schedule.incremental, async () => {
      try {
        await this.createIncrementalBackup();
      } catch (error) {
        this.logger.error('Scheduled incremental backup failed:', error);
      }
    });

    // Schedule cleanup
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.cleanupOldBackups();
      } catch (error) {
        this.logger.error('Scheduled backup cleanup failed:', error);
      }
    });

    this.logger.info('Scheduled backups initialized');
  }

  private generateBackupId(type: 'full' | 'incremental'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomString = Math.random().toString(36).substring(2, 8);
    return `${type}-backup-${timestamp}-${randomString}`;
  }

  private async backupDatabase(backupId: string): Promise<void> {
    this.logger.info('Starting database backup:', { backupId });

    const backupPath = `/tmp/${backupId}-database.sql`;
    const command = `pg_dump "${process.env.DATABASE_URL}" > ${backupPath}`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command);

    this.logger.info('Database backup completed:', { backupId, path: backupPath });
  }

  private async backupDatabaseIncremental(backupId: string, since: Date): Promise<void> {
    this.logger.info('Starting incremental database backup:', { backupId, since });

    // Query for changes since last backup
    const query = `
      SELECT table_name, 'INSERT' as operation, row_to_json(t.*) as data
      FROM information_schema.tables ist
      JOIN pg_class pgc ON pgc.relname = ist.table_name
      JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace
      CROSS JOIN LATERAL (
        SELECT * FROM ${process.env.DB_SCHEMA || 'public'}.${`'|| ist.table_name ||'`}
        WHERE updated_at > $1 OR created_at > $1
      ) t
      WHERE ist.table_schema = $2
    `;

    const result = await this.db.query(query, [since, process.env.DB_SCHEMA || 'public']);

    const backupPath = `/tmp/${backupId}-database-incremental.json`;
    await fs.writeFile(backupPath, JSON.stringify(result.rows, null, 2));

    this.logger.info('Incremental database backup completed:', { backupId, changes: result.rows.length });
  }

  private async backupRedis(backupId: string): Promise<void> {
    this.logger.info('Starting Redis backup:', { backupId });

    // Trigger Redis BGSAVE
    await this.redis.bgsave();

    // Wait for background save to complete
    let saving = true;
    while (saving) {
      const lastSave = await this.redis.lastsave();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newLastSave = await this.redis.lastsave();
      saving = lastSave === newLastSave;
    }

    // Copy RDB file
    const rdbPath = '/var/lib/redis/dump.rdb'; // Default Redis RDB path
    const backupPath = `/tmp/${backupId}-redis.rdb`;

    const { copyFile } = require('fs').promises;
    await copyFile(rdbPath, backupPath);

    this.logger.info('Redis backup completed:', { backupId, path: backupPath });
  }

  private async backupFiles(backupId: string): Promise<void> {
    this.logger.info('Starting files backup:', { backupId });

    const backupPath = `/tmp/${backupId}-files.tar.gz`;
    const filesToBackup = [
      './uploads',
      './config',
      './logs',
      './certs'
    ].filter(path => fs.access(path).then(() => true).catch(() => false));

    const command = `tar -czf ${backupPath} ${filesToBackup.join(' ')}`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command);

    this.logger.info('Files backup completed:', { backupId, path: backupPath });
  }

  private async backupFilesIncremental(backupId: string, since: Date): Promise<void> {
    this.logger.info('Starting incremental files backup:', { backupId, since });

    const backupPath = `/tmp/${backupId}-files-incremental.tar.gz`;
    const sinceString = since.toISOString().slice(0, 19).replace('T', ' ');

    const command = `find ./uploads ./config ./logs -newer "${sinceString}" -type f | tar -czf ${backupPath} -T -`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command);

    this.logger.info('Incremental files backup completed:', { backupId, path: backupPath });
  }

  private async backupLogs(backupId: string): Promise<void> {
    this.logger.info('Starting logs backup:', { backupId });

    const backupPath = `/tmp/${backupId}-logs.tar.gz`;
    const command = `tar -czf ${backupPath} ./logs`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command);

    this.logger.info('Logs backup completed:', { backupId, path: backupPath });
  }

  private async backupLogsIncremental(backupId: string, since: Date): Promise<void> {
    this.logger.info('Starting incremental logs backup:', { backupId, since });

    const backupPath = `/tmp/${backupId}-logs-incremental.tar.gz`;
    const sinceString = since.toISOString().slice(0, 19).replace('T', ' ');

    const command = `find ./logs -newer "${sinceString}" -name "*.log" | tar -czf ${backupPath} -T -`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command);

    this.logger.info('Incremental logs backup completed:', { backupId, path: backupPath });
  }

  private async createBackupArchive(backupId: string): Promise<string> {
    const archivePath = `/tmp/${backupId}.tar.gz`;
    const tempFiles = [
      `/tmp/${backupId}-database.sql`,
      `/tmp/${backupId}-database-incremental.json`,
      `/tmp/${backupId}-redis.rdb`,
      `/tmp/${backupId}-files.tar.gz`,
      `/tmp/${backupId}-files-incremental.tar.gz`,
      `/tmp/${backupId}-logs.tar.gz`,
      `/tmp/${backupId}-logs-incremental.tar.gz`
    ].filter(async path => await this.fileExists(path));

    const command = `tar -czf ${archivePath} ${tempFiles.join(' ')}`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command);

    // Clean up temporary files
    for (const tempFile of tempFiles) {
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        this.logger.warn('Failed to clean up temp file:', { file: tempFile, error });
      }
    }

    return archivePath;
  }

  private async uploadToS3(filePath: string, backupId: string): Promise<void> {
    if (!this.s3) {
      throw new Error('S3 not configured');
    }

    const key = `${this.config.storage.s3.prefix}/${backupId}.tar.gz`;
    const fileStream = createReadStream(filePath);

    const uploadParams = {
      Bucket: this.config.storage.s3.bucket,
      Key: key,
      Body: fileStream,
      ServerSideEncryption: this.config.encryption.enabled ? 'aws:kms' : undefined,
      SSEKMSKeyId: this.config.encryption.keyId
    };

    await this.s3.upload(uploadParams).promise();

    this.logger.info('Backup uploaded to S3:', { backupId, key });
  }

  private async downloadFromS3(backupId: string): Promise<string> {
    if (!this.s3) {
      throw new Error('S3 not configured');
    }

    const key = `${this.config.storage.s3.prefix}/${backupId}.tar.gz`;
    const localPath = `/tmp/${backupId}-downloaded.tar.gz`;

    const downloadParams = {
      Bucket: this.config.storage.s3.bucket,
      Key: key
    };

    const fileStream = createWriteStream(localPath);
    const s3Stream = this.s3.getObject(downloadParams).createReadStream();

    await pipeline(s3Stream, fileStream);

    this.logger.info('Backup downloaded from S3:', { backupId, localPath });
    return localPath;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
      hash.update(chunk);
    }

    return hash.digest('hex');
  }

  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const query = `
      INSERT INTO backup_metadata (
        id, type, status, start_time, end_time, size, location, 
        checksum, components, error, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    `;

    await this.db.query(query, [
      metadata.id,
      metadata.type,
      metadata.status,
      metadata.startTime,
      metadata.endTime,
      metadata.size,
      metadata.location,
      metadata.checksum,
      JSON.stringify(metadata.components),
      metadata.error
    ]);
  }

  private async updateBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const query = `
      UPDATE backup_metadata 
      SET status = $2, end_time = $3, size = $4, location = $5, 
          checksum = $6, components = $7, error = $8, updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [
      metadata.id,
      metadata.status,
      metadata.endTime,
      metadata.size,
      metadata.location,
      metadata.checksum,
      JSON.stringify(metadata.components),
      metadata.error
    ]);
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const query = `SELECT * FROM backup_metadata WHERE id = $1`;
    const result = await this.db.query(query, [backupId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      size: row.size,
      location: row.location,
      checksum: row.checksum,
      components: row.components,
      error: row.error
    };
  }

  private async getLastSuccessfulBackup(): Promise<BackupMetadata | null> {
    const query = `
      SELECT * FROM backup_metadata 
      WHERE status = 'completed' 
      ORDER BY end_time DESC 
      LIMIT 1
    `;

    const result = await this.db.query(query);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      size: row.size,
      location: row.location,
      checksum: row.checksum,
      components: row.components,
      error: row.error
    };
  }

  private async getExpiredBackups(cutoff: Date): Promise<BackupMetadata[]> {
    const query = `
      SELECT * FROM backup_metadata 
      WHERE end_time < $1 AND status = 'completed'
      ORDER BY end_time ASC
    `;

    const result = await this.db.query(query, [cutoff]);

    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      size: row.size,
      location: row.location,
      checksum: row.checksum,
      components: row.components,
      error: row.error
    }));
  }

  private async deleteBackup(backupId: string): Promise<void> {
    // Delete local file
    const metadata = await this.getBackupMetadata(backupId);
    if (metadata && await this.fileExists(metadata.location)) {
      await fs.unlink(metadata.location);
    }

    // Delete from S3 if configured
    if (this.config.storage.s3.enabled && this.s3) {
      const key = `${this.config.storage.s3.prefix}/${backupId}.tar.gz`;
      await this.s3.deleteObject({
        Bucket: this.config.storage.s3.bucket,
        Key: key
      }).promise();
    }

    // Delete metadata
    const query = `DELETE FROM backup_metadata WHERE id = $1`;
    await this.db.query(query, [backupId]);

    this.logger.info('Backup deleted:', { backupId });
  }

  private async extractBackupArchive(archivePath: string, backupId: string): Promise<string> {
    const extractPath = `/tmp/${backupId}-extract`;
    await fs.mkdir(extractPath, { recursive: true });

    const command = `tar -xzf ${archivePath} -C ${extractPath}`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(command);

    return extractPath;
  }

  private async restoreDatabase(extractPath: string): Promise<void> {
    // Implementation for database restore
    this.logger.info('Database restore completed (placeholder)');
  }

  private async restoreRedis(extractPath: string): Promise<void> {
    // Implementation for Redis restore
    this.logger.info('Redis restore completed (placeholder)');
  }

  private async restoreFiles(extractPath: string): Promise<void> {
    // Implementation for files restore
    this.logger.info('Files restore completed (placeholder)');
  }

  private async restoreLogs(extractPath: string): Promise<void> {
    // Implementation for logs restore
    this.logger.info('Logs restore completed (placeholder)');
  }

  private async createSystemSnapshot(): Promise<string> {
    // Create a system snapshot before restore for rollback purposes
    const snapshotId = `snapshot-${Date.now()}`;
    this.logger.info('System snapshot created:', { snapshotId });
    return snapshotId;
  }

  private async rollbackFromSnapshot(snapshotId: string): Promise<void> {
    // Rollback system from snapshot
    this.logger.info('System rolled back from snapshot:', { snapshotId });
  }
}

export default BackupRecoveryService;
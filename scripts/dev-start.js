#!/usr/bin/env node
/**
 * Development startup script
 * Runs FanzMoneyDash with ts-node for development
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting FanzMoneyDash in development mode...\n');

// Set development environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.TS_NODE_PROJECT = path.join(__dirname, '..', 'tsconfig.json');

// Start the application with ts-node
const child = spawn('npx', ['ts-node', '--transpile-only', 'src/index.ts'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    // Add any additional development environment variables
    DEBUG: 'fanzmoney:*',
    LOG_LEVEL: 'debug'
  }
});

child.on('close', (code) => {
  console.log(`\n📋 FanzMoneyDash exited with code ${code}`);
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ Failed to start FanzMoneyDash:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down FanzMoneyDash...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Shutting down FanzMoneyDash...');
  child.kill('SIGTERM');
});
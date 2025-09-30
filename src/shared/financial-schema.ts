/**
 * FanzMoneyDash™ Financial Schema Extension
 * Extends existing FanzDash schema with comprehensive financial operations
 * Compatible with existing 77+ table architecture
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  decimal, 
  timestamp, 
  boolean, 
  integer, 
  json,
  index,
  foreignKey,
  primaryKey
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ========================================
// PAYMENT PROCESSORS & MERCHANT ACCOUNTS
// ========================================

export const paymentProcessors = pgTable('payment_processors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  processorType: varchar('processor_type', { length: 50 }).notNull(), // 'adult_safe', 'crypto', 'alternative'
  rails: json('rails').$type<string[]>().notNull().default([]), // ['card', 'bank', 'crypto']
  regionTags: json('region_tags').$type<string[]>().notNull().default([]),
  currencies: json('currencies').$type<string[]>().notNull().default([]),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, inactive, maintenance
  apiEndpoint: varchar('api_endpoint', { length: 255 }),
  webhookEndpoint: varchar('webhook_endpoint', { length: 255 }),
  configuration: json('configuration').$type<Record<string, any>>().notNull().default({}),
  fees: json('fees').$type<{
    cardRate?: number;
    fixedFee?: number;
    currency?: string;
    chargebackFee?: number;
  }>().notNull().default({}),
  limits: json('limits').$type<{
    minAmount?: number;
    maxAmount?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  }>().notNull().default({}),
  complianceInfo: json('compliance_info').$type<{
    pciCompliant?: boolean;
    adultContentAllowed?: boolean;
    kycRequired?: boolean;
  }>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('payment_processors_name_idx').on(table.name),
  statusIdx: index('payment_processors_status_idx').on(table.status),
  typeIdx: index('payment_processors_type_idx').on(table.processorType),
}));

export const merchantAccounts = pgTable('merchant_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  processorId: uuid('processor_id').notNull().references(() => paymentProcessors.id),
  midIdentifier: varchar('mid_identifier', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  region: varchar('region', { length: 10 }).notNull(), // US, EU, APAC, etc.
  descriptor: varchar('descriptor', { length: 25 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  limits: json('limits').$type<{
    dailyVolume?: number;
    monthlyVolume?: number;
    transactionLimit?: number;
    chargebackThreshold?: number;
  }>().notNull().default({}),
  riskProfile: varchar('risk_profile', { length: 20 }).notNull().default('medium'), // low, medium, high
  platformRestrictions: json('platform_restrictions').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  processorIdx: index('merchant_accounts_processor_idx').on(table.processorId),
  statusIdx: index('merchant_accounts_status_idx').on(table.status),
  regionIdx: index('merchant_accounts_region_idx').on(table.region),
}));

// ========================================
// PAYMENT ROUTING RULES
// ========================================

export const routingRules = pgTable('routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  priority: integer('priority').notNull().default(100),
  isActive: boolean('is_active').notNull().default(true),
  conditions: json('conditions').$type<{
    platforms?: string[];
    regions?: string[];
    currencies?: string[];
    paymentMethods?: string[];
    amountRange?: { min?: number; max?: number };
    riskScoreRange?: { min?: number; max?: number };
    binRanges?: string[];
    timeWindows?: { start: string; end: string }[];
    userTags?: string[];
  }>().notNull().default({}),
  targets: json('targets').$type<{
    primaryMid?: string;
    fallbackMids?: string[];
    processorId?: string;
    splitPercentage?: number;
  }>().notNull().default({}),
  canaryConfig: json('canary_config').$type<{
    enabled?: boolean;
    percentage?: number;
    platforms?: string[];
  }>().notNull().default({}),
  createdBy: uuid('created_by').notNull(),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  priorityIdx: index('routing_rules_priority_idx').on(table.priority),
  activeIdx: index('routing_rules_active_idx').on(table.isActive),
  createdByIdx: index('routing_rules_created_by_idx').on(table.createdBy),
}));

// ========================================
// TRANSACTIONS & EVENTS
// ========================================

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 100 }).unique(), // Processor transaction ID
  platformId: varchar('platform_id', { length: 50 }).notNull(),
  userId: uuid('user_id').notNull(),
  creatorId: uuid('creator_id'),
  midId: uuid('mid_id').references(() => merchantAccounts.id),
  processorId: uuid('processor_id').notNull().references(() => paymentProcessors.id),
  
  // Financial Details
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  fees: decimal('fees', { precision: 15, scale: 2 }).notNull().default('0.00'),
  netAmount: decimal('net_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Transaction Details
  type: varchar('type', { length: 50 }).notNull(), // subscription, tip, ppv, merchandise, etc.
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, authorized, captured, failed, refunded
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // card, crypto, bank, wallet
  
  // Risk & Trust
  trustScore: integer('trust_score'), // 0-100
  riskFlags: json('risk_flags').$type<string[]>().notNull().default([]),
  fraudSignals: json('fraud_signals').$type<Record<string, any>>().notNull().default({}),
  
  // Metadata
  metadata: json('metadata').$type<Record<string, any>>().notNull().default({}),
  processorResponse: json('processor_response').$type<Record<string, any>>().notNull().default({}),
  
  // Timestamps
  initiatedAt: timestamp('initiated_at').notNull().defaultNow(),
  authorizedAt: timestamp('authorized_at'),
  capturedAt: timestamp('captured_at'),
  failedAt: timestamp('failed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  platformUserIdx: index('transactions_platform_user_idx').on(table.platformId, table.userId),
  creatorIdx: index('transactions_creator_idx').on(table.creatorId),
  statusIdx: index('transactions_status_idx').on(table.status),
  processorIdx: index('transactions_processor_idx').on(table.processorId),
  midIdx: index('transactions_mid_idx').on(table.midId),
  externalIdIdx: index('transactions_external_id_idx').on(table.externalId),
  typeIdx: index('transactions_type_idx').on(table.type),
  createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
  trustScoreIdx: index('transactions_trust_score_idx').on(table.trustScore),
}));

export const transactionEvents = pgTable('transaction_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  eventType: varchar('event_type', { length: 50 }).notNull(), // auth, capture, refund, dispute, settlement
  eventSource: varchar('event_source', { length: 50 }).notNull(), // processor, internal, webhook
  eventData: json('event_data').$type<Record<string, any>>().notNull().default({}),
  processorEventId: varchar('processor_event_id', { length: 100 }),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  currency: varchar('currency', { length: 3 }),
  success: boolean('success').notNull().default(true),
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  transactionIdx: index('transaction_events_transaction_idx').on(table.transactionId),
  typeIdx: index('transaction_events_type_idx').on(table.eventType),
  sourceIdx: index('transaction_events_source_idx').on(table.eventSource),
  createdAtIdx: index('transaction_events_created_at_idx').on(table.createdAt),
}));

// ========================================
// REFUNDS & DISPUTES
// ========================================

export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  externalRefundId: varchar('external_refund_id', { length: 100 }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  reason: varchar('reason', { length: 100 }).notNull(),
  reasonDetails: text('reason_details'),
  origin: varchar('origin', { length: 20 }).notNull(), // auto, manual, appeal, chargeback
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, approved, denied, processed, failed
  
  // FanzTrust Integration
  trustVerificationId: uuid('trust_verification_id'),
  trustScore: integer('trust_score'),
  
  // Approval Workflow
  requestedBy: uuid('requested_by').notNull(),
  reviewedBy: uuid('reviewed_by'),
  approvedBy: uuid('approved_by'),
  decisionReason: text('decision_reason'),
  
  // Evidence & Documentation
  evidence: json('evidence').$type<{
    contentAccessed?: boolean;
    accessDuration?: number;
    deviceFingerprint?: string;
    ipAddress?: string;
    screenshots?: string[];
    supportingDocs?: string[];
  }>().notNull().default({}),
  
  // Creator Impact
  creatorNotified: boolean('creator_notified').notNull().default(false),
  creatorResponse: json('creator_response').$type<Record<string, any>>().notNull().default({}),
  
  // Processing
  processorResponse: json('processor_response').$type<Record<string, any>>().notNull().default({}),
  ledgerEntryId: varchar('ledger_entry_id', { length: 100 }),
  
  // Timestamps
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  approvedAt: timestamp('approved_at'),
  processedAt: timestamp('processed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  transactionIdx: index('refunds_transaction_idx').on(table.transactionId),
  statusIdx: index('refunds_status_idx').on(table.status),
  originIdx: index('refunds_origin_idx').on(table.origin),
  requestedByIdx: index('refunds_requested_by_idx').on(table.requestedBy),
  createdAtIdx: index('refunds_created_at_idx').on(table.createdAt),
}));

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  externalDisputeId: varchar('external_dispute_id', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // chargeback, retrieval, pre_arbitration, arbitration
  stage: varchar('stage', { length: 50 }).notNull(), // initial, response_due, pre_arbitration, arbitration, closed
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  reasonCode: varchar('reason_code', { length: 20 }).notNull(),
  reasonDescription: text('reason_description'),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  
  // Important Dates
  deadlineAt: timestamp('deadline_at'),
  receivedAt: timestamp('received_at').notNull(),
  respondedAt: timestamp('responded_at'),
  resolvedAt: timestamp('resolved_at'),
  
  // Response Details
  responseSubmitted: boolean('response_submitted').notNull().default(false),
  responseEvidence: json('response_evidence').$type<{
    documents?: string[];
    description?: string;
    submittedBy?: string;
  }>().notNull().default({}),
  
  // Outcome
  outcome: varchar('outcome', { length: 50 }), // won, lost, accepted, partial
  recoveredAmount: decimal('recovered_amount', { precision: 15, scale: 2 }),
  
  // Processing
  processorData: json('processor_data').$type<Record<string, any>>().notNull().default({}),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  transactionIdx: index('disputes_transaction_idx').on(table.transactionId),
  statusIdx: index('disputes_status_idx').on(table.status),
  stageIdx: index('disputes_stage_idx').on(table.stage),
  typeIdx: index('disputes_type_idx').on(table.type),
  deadlineIdx: index('disputes_deadline_idx').on(table.deadlineAt),
  createdAtIdx: index('disputes_created_at_idx').on(table.createdAt),
}));

// ========================================
// SETTLEMENTS & RECONCILIATION
// ========================================

export const settlements = pgTable('settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  processorId: uuid('processor_id').notNull().references(() => paymentProcessors.id),
  batchId: varchar('batch_id', { length: 100 }).notNull(),
  settlementDate: timestamp('settlement_date').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  
  // Amounts
  grossAmount: decimal('gross_amount', { precision: 15, scale: 2 }).notNull(),
  fees: decimal('fees', { precision: 15, scale: 2 }).notNull(),
  chargebacks: decimal('chargebacks', { precision: 15, scale: 2 }).notNull().default('0.00'),
  refunds: decimal('refunds', { precision: 15, scale: 2 }).notNull().default('0.00'),
  netAmount: decimal('net_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Processing
  transactionCount: integer('transaction_count').notNull().default(0),
  fileUrl: varchar('file_url', { length: 500 }),
  fileHash: varchar('file_hash', { length: 64 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processed, reconciled, disputed
  
  // Reconciliation
  reconciledAt: timestamp('reconciled_at'),
  reconciledBy: uuid('reconciled_by'),
  discrepancies: json('discrepancies').$type<{
    missingTransactions?: string[];
    amountMismatches?: { transactionId: string; expected: number; actual: number }[];
    unexpectedTransactions?: string[];
  }>().notNull().default({}),
  
  // Ledger Integration
  ledgerEntryId: varchar('ledger_entry_id', { length: 100 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  processorIdx: index('settlements_processor_idx').on(table.processorId),
  batchIdx: index('settlements_batch_idx').on(table.batchId),
  dateIdx: index('settlements_date_idx').on(table.settlementDate),
  statusIdx: index('settlements_status_idx').on(table.status),
}));

// ========================================
// PAYOUTS & CREATOR EARNINGS
// ========================================

export const payoutMethods = pgTable('payout_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // paxum, epayservice, wise, bank, crypto
  rails: json('rails').$type<string[]>().notNull().default([]),
  currencies: json('currencies').$type<string[]>().notNull().default([]),
  regions: json('regions').$type<string[]>().notNull().default([]),
  fees: json('fees').$type<{
    fixedFee?: number;
    percentageFee?: number;
    currency?: string;
    minimumFee?: number;
    maximumFee?: number;
  }>().notNull().default({}),
  limits: json('limits').$type<{
    minAmount?: number;
    maxAmount?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  }>().notNull().default({}),
  processingTime: varchar('processing_time', { length: 100 }), // "1-2 business days"
  requirements: json('requirements').$type<{
    kyc?: boolean;
    bankAccount?: boolean;
    taxId?: boolean;
    address?: boolean;
  }>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  typeIdx: index('payout_methods_type_idx').on(table.type),
  activeIdx: index('payout_methods_active_idx').on(table.isActive),
}));

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull(),
  batchId: uuid('batch_id'),
  payoutMethodId: uuid('payout_method_id').notNull().references(() => payoutMethods.id),
  
  // Financial Details
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  fees: decimal('fees', { precision: 15, scale: 2 }).notNull().default('0.00'),
  netAmount: decimal('net_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Status & Processing
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, approved, sent, completed, failed, cancelled
  externalPayoutId: varchar('external_payout_id', { length: 100 }),
  failureReason: text('failure_reason'),
  
  // Creator Information
  creatorPayoutInfo: json('creator_payout_info').$type<{
    email?: string;
    bankAccount?: string;
    walletAddress?: string;
    recipientName?: string;
    metadata?: Record<string, any>;
  }>().notNull().default({}),
  
  // Approval Workflow
  requestedBy: uuid('requested_by'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  
  // Processing Details
  processorResponse: json('processor_response').$type<Record<string, any>>().notNull().default({}),
  
  // Tax & Compliance
  taxWithholding: decimal('tax_withholding', { precision: 15, scale: 2 }).notNull().default('0.00'),
  taxYear: integer('tax_year'),
  form1099Generated: boolean('form_1099_generated').notNull().default(false),
  
  // Ledger Integration
  ledgerEntryId: varchar('ledger_entry_id', { length: 100 }),
  
  // Timestamps
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  sentAt: timestamp('sent_at'),
  completedAt: timestamp('completed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  creatorIdx: index('payouts_creator_idx').on(table.creatorId),
  statusIdx: index('payouts_status_idx').on(table.status),
  batchIdx: index('payouts_batch_idx').on(table.batchId),
  methodIdx: index('payouts_method_idx').on(table.payoutMethodId),
  createdAtIdx: index('payouts_created_at_idx').on(table.createdAt),
}));

export const payoutBatches = pgTable('payout_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchNumber: varchar('batch_number', { length: 50 }).notNull().unique(),
  payoutMethodId: uuid('payout_method_id').notNull().references(() => payoutMethods.id),
  
  // Batch Details
  payoutCount: integer('payout_count').notNull().default(0),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  totalFees: decimal('total_fees', { precision: 15, scale: 2 }).notNull(),
  netAmount: decimal('net_amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  
  // Processing
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  fileUrl: varchar('file_url', { length: 500 }),
  externalBatchId: varchar('external_batch_id', { length: 100 }),
  
  // Workflow
  createdBy: uuid('created_by').notNull(),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  batchNumberIdx: index('payout_batches_batch_number_idx').on(table.batchNumber),
  statusIdx: index('payout_batches_status_idx').on(table.status),
  methodIdx: index('payout_batches_method_idx').on(table.payoutMethodId),
  createdAtIdx: index('payout_batches_created_at_idx').on(table.createdAt),
}));

// ========================================
// FANZTRUST™ VERIFICATION & RISK SCORING
// ========================================

export const trustScores = pgTable('trust_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').references(() => transactions.id),
  userId: uuid('user_id').notNull(),
  entityType: varchar('entity_type', { length: 20 }).notNull(), // transaction, user, refund_request
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  
  // Scoring
  score: integer('score').notNull(), // 0-100
  confidence: integer('confidence').notNull(), // 0-100
  modelVersion: varchar('model_version', { length: 20 }).notNull(),
  
  // Decision
  decision: varchar('decision', { length: 20 }).notNull(), // allow, challenge, block, refund
  reasonCodes: json('reason_codes').$type<string[]>().notNull().default([]),
  
  // Signals Used
  signals: json('signals').$type<{
    device?: {
      fingerprint?: string;
      reputation?: number;
      velocity?: number;
      newDevice?: boolean;
    };
    network?: {
      ipReputation?: number;
      geoVelocity?: number;
      torVpn?: boolean;
      suspiciousIsp?: boolean;
    };
    payment?: {
      avsResult?: string;
      cvvResult?: string;
      binCountry?: string;
      issuerType?: string;
      prepaidCard?: boolean;
    };
    behavioral?: {
      accountAge?: number;
      spendingPattern?: number;
      refundHistory?: number;
      velocityScore?: number;
    };
    platform?: {
      riskLevel?: string;
      contentType?: string;
      creatorTier?: string;
    };
  }>().notNull().default({}),
  
  // Explanation
  explanation: json('explanation').$type<{
    primaryFactors?: string[];
    riskFactors?: string[];
    protectiveFactors?: string[];
    recommendations?: string[];
  }>().notNull().default({}),
  
  // Processing Details
  processingTimeMs: integer('processing_time_ms'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  transactionIdx: index('trust_scores_transaction_idx').on(table.transactionId),
  userIdx: index('trust_scores_user_idx').on(table.userId),
  entityIdx: index('trust_scores_entity_idx').on(table.entityType, table.entityId),
  scoreIdx: index('trust_scores_score_idx').on(table.score),
  decisionIdx: index('trust_scores_decision_idx').on(table.decision),
  createdAtIdx: index('trust_scores_created_at_idx').on(table.createdAt),
}));

// ========================================
// APPROVALS WORKFLOW
// ========================================

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // transaction, refund, payout, routing_rule
  entityId: uuid('entity_id').notNull(),
  approvalType: varchar('approval_type', { length: 50 }).notNull(), // high_risk_transaction, refund_request, large_payout
  
  // Current State
  state: varchar('state', { length: 20 }).notNull().default('pending'), // pending, approved, denied, escalated, expired
  priority: varchar('priority', { length: 10 }).notNull().default('medium'), // low, medium, high, urgent
  
  // Assignment
  assigneeId: uuid('assignee_id'),
  assignedTeam: varchar('assigned_team', { length: 50 }),
  
  // SLA
  slaMinutes: integer('sla_minutes').notNull().default(240), // 4 hours default
  slaAt: timestamp('sla_at').notNull(),
  escalatedAt: timestamp('escalated_at'),
  
  // Request Details
  requestedBy: uuid('requested_by').notNull(),
  requestReason: text('request_reason'),
  requestData: json('request_data').$type<Record<string, any>>().notNull().default({}),
  
  // Decision
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at'),
  decision: varchar('decision', { length: 20 }), // approved, denied
  decisionReason: text('decision_reason'),
  decisionData: json('decision_data').$type<Record<string, any>>().notNull().default({}),
  
  // Audit Trail
  history: json('history').$type<{
    timestamp: string;
    action: string;
    actor: string;
    details?: Record<string, any>;
  }[]>().notNull().default([]),
  
  // Notifications
  notificationsSent: json('notifications_sent').$type<{
    timestamp: string;
    type: string;
    recipient: string;
    success: boolean;
  }[]>().notNull().default([]),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('approvals_entity_idx').on(table.entityType, table.entityId),
  stateIdx: index('approvals_state_idx').on(table.state),
  assigneeIdx: index('approvals_assignee_idx').on(table.assigneeId),
  priorityIdx: index('approvals_priority_idx').on(table.priority),
  slaIdx: index('approvals_sla_idx').on(table.slaAt),
  createdAtIdx: index('approvals_created_at_idx').on(table.createdAt),
}));

// ========================================
// FINANCIAL AUDIT TRAIL
// ========================================

export const financialAuditTrail = pgTable('financial_audit_trail', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Actor Information
  actorType: varchar('actor_type', { length: 20 }).notNull(), // user, system, processor
  actorId: varchar('actor_id', { length: 100 }).notNull(),
  actorName: varchar('actor_name', { length: 255 }),
  
  // Action Details
  action: varchar('action', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // payment, payout, refund, dispute, routing
  
  // Entity Information
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  
  // Change Details
  beforeState: json('before_state').$type<Record<string, any>>().notNull().default({}),
  afterState: json('after_state').$type<Record<string, any>>().notNull().default({}),
  
  // Context
  platformId: varchar('platform_id', { length: 50 }),
  sessionId: varchar('session_id', { length: 100 }),
  requestId: varchar('request_id', { length: 100 }),
  
  // Network Information
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  geoLocation: json('geo_location').$type<{
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  }>().notNull().default({}),
  
  // Risk & Compliance
  riskLevel: varchar('risk_level', { length: 10 }).notNull().default('low'),
  complianceFlags: json('compliance_flags').$type<string[]>().notNull().default([]),
  
  // Additional Context
  metadata: json('metadata').$type<Record<string, any>>().notNull().default({}),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  actorIdx: index('financial_audit_trail_actor_idx').on(table.actorType, table.actorId),
  actionIdx: index('financial_audit_trail_action_idx').on(table.action),
  categoryIdx: index('financial_audit_trail_category_idx').on(table.category),
  entityIdx: index('financial_audit_trail_entity_idx').on(table.entityType, table.entityId),
  platformIdx: index('financial_audit_trail_platform_idx').on(table.platformId),
  createdAtIdx: index('financial_audit_trail_created_at_idx').on(table.createdAt),
  riskIdx: index('financial_audit_trail_risk_idx').on(table.riskLevel),
}));

// ========================================
// FINANCIAL PRODUCT CONFIGURATIONS
// ========================================

export const financialProducts = pgTable('financial_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  productType: varchar('product_type', { length: 50 }).notNull(), // fanzpay, fanzmoney, fanztoken, fanzcard, fanzrev, fanzcredit
  productName: varchar('product_name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Configuration
  configuration: json('configuration').$type<Record<string, any>>().notNull().default({}),
  
  // Platform Availability
  enabledPlatforms: json('enabled_platforms').$type<string[]>().notNull().default([]),
  regionAvailability: json('region_availability').$type<string[]>().notNull().default([]),
  
  // Feature Flags
  isActive: boolean('is_active').notNull().default(true),
  isBeta: boolean('is_beta').notNull().default(false),
  rolloutPercentage: integer('rollout_percentage').notNull().default(100),
  
  // Limits & Rules
  limits: json('limits').$type<Record<string, any>>().notNull().default({}),
  rules: json('rules').$type<Record<string, any>>().notNull().default({}),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  productTypeIdx: index('financial_products_type_idx').on(table.productType),
  activeIdx: index('financial_products_active_idx').on(table.isActive),
  betaIdx: index('financial_products_beta_idx').on(table.isBeta),
}));

// ========================================
// RELATIONSHIPS & FOREIGN KEYS
// ========================================

// Add foreign key relationships as needed based on your existing schema
// These would connect to your existing users, platforms, and other tables

// Export all tables for use in Drizzle queries
export const financialSchema = {
  // Core Financial Infrastructure
  paymentProcessors,
  merchantAccounts,
  routingRules,
  
  // Transactions
  transactions,
  transactionEvents,
  
  // Refunds & Disputes
  refunds,
  disputes,
  
  // Settlements
  settlements,
  
  // Payouts
  payoutMethods,
  payouts,
  payoutBatches,
  
  // FanzTrust™
  trustScores,
  
  // Workflow
  approvals,
  
  // Audit
  financialAuditTrail,
  
  // Products
  financialProducts,
};

export type PaymentProcessor = typeof paymentProcessors.$inferSelect;
export type NewPaymentProcessor = typeof paymentProcessors.$inferInsert;

export type MerchantAccount = typeof merchantAccounts.$inferSelect;
export type NewMerchantAccount = typeof merchantAccounts.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;

export type TrustScore = typeof trustScores.$inferSelect;
export type NewTrustScore = typeof trustScores.$inferInsert;

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;

export type FinancialAuditEntry = typeof financialAuditTrail.$inferSelect;
export type NewFinancialAuditEntry = typeof financialAuditTrail.$inferInsert;
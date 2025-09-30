"use strict";
/**
 * FanzMoneyDash™ Financial Schema Extension
 * Extends existing FanzDash schema with comprehensive financial operations
 * Compatible with existing 77+ table architecture
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.financialSchema = exports.financialProducts = exports.financialAuditTrail = exports.approvals = exports.trustScores = exports.payoutBatches = exports.payouts = exports.payoutMethods = exports.settlements = exports.disputes = exports.refunds = exports.transactionEvents = exports.transactions = exports.routingRules = exports.merchantAccounts = exports.paymentProcessors = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// ========================================
// PAYMENT PROCESSORS & MERCHANT ACCOUNTS
// ========================================
exports.paymentProcessors = (0, pg_core_1.pgTable)('payment_processors', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    displayName: (0, pg_core_1.varchar)('display_name', { length: 255 }).notNull(),
    processorType: (0, pg_core_1.varchar)('processor_type', { length: 50 }).notNull(), // 'adult_safe', 'crypto', 'alternative'
    rails: (0, pg_core_1.json)('rails').$type().notNull().default([]), // ['card', 'bank', 'crypto']
    regionTags: (0, pg_core_1.json)('region_tags').$type().notNull().default([]),
    currencies: (0, pg_core_1.json)('currencies').$type().notNull().default([]),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('active'), // active, inactive, maintenance
    apiEndpoint: (0, pg_core_1.varchar)('api_endpoint', { length: 255 }),
    webhookEndpoint: (0, pg_core_1.varchar)('webhook_endpoint', { length: 255 }),
    configuration: (0, pg_core_1.json)('configuration').$type().notNull().default({}),
    fees: (0, pg_core_1.json)('fees').$type().notNull().default({}),
    limits: (0, pg_core_1.json)('limits').$type().notNull().default({}),
    complianceInfo: (0, pg_core_1.json)('compliance_info').$type().notNull().default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    nameIdx: (0, pg_core_1.index)('payment_processors_name_idx').on(table.name),
    statusIdx: (0, pg_core_1.index)('payment_processors_status_idx').on(table.status),
    typeIdx: (0, pg_core_1.index)('payment_processors_type_idx').on(table.processorType),
}));
exports.merchantAccounts = (0, pg_core_1.pgTable)('merchant_accounts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    processorId: (0, pg_core_1.uuid)('processor_id').notNull().references(() => exports.paymentProcessors.id),
    midIdentifier: (0, pg_core_1.varchar)('mid_identifier', { length: 100 }).notNull(),
    displayName: (0, pg_core_1.varchar)('display_name', { length: 255 }).notNull(),
    region: (0, pg_core_1.varchar)('region', { length: 10 }).notNull(), // US, EU, APAC, etc.
    descriptor: (0, pg_core_1.varchar)('descriptor', { length: 25 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('active'),
    limits: (0, pg_core_1.json)('limits').$type().notNull().default({}),
    riskProfile: (0, pg_core_1.varchar)('risk_profile', { length: 20 }).notNull().default('medium'), // low, medium, high
    platformRestrictions: (0, pg_core_1.json)('platform_restrictions').$type().notNull().default([]),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    processorIdx: (0, pg_core_1.index)('merchant_accounts_processor_idx').on(table.processorId),
    statusIdx: (0, pg_core_1.index)('merchant_accounts_status_idx').on(table.status),
    regionIdx: (0, pg_core_1.index)('merchant_accounts_region_idx').on(table.region),
}));
// ========================================
// PAYMENT ROUTING RULES
// ========================================
exports.routingRules = (0, pg_core_1.pgTable)('routing_rules', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    priority: (0, pg_core_1.integer)('priority').notNull().default(100),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    conditions: (0, pg_core_1.json)('conditions').$type().notNull().default({}),
    targets: (0, pg_core_1.json)('targets').$type().notNull().default({}),
    canaryConfig: (0, pg_core_1.json)('canary_config').$type().notNull().default({}),
    createdBy: (0, pg_core_1.uuid)('created_by').notNull(),
    approvedBy: (0, pg_core_1.uuid)('approved_by'),
    approvedAt: (0, pg_core_1.timestamp)('approved_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    priorityIdx: (0, pg_core_1.index)('routing_rules_priority_idx').on(table.priority),
    activeIdx: (0, pg_core_1.index)('routing_rules_active_idx').on(table.isActive),
    createdByIdx: (0, pg_core_1.index)('routing_rules_created_by_idx').on(table.createdBy),
}));
// ========================================
// TRANSACTIONS & EVENTS
// ========================================
exports.transactions = (0, pg_core_1.pgTable)('transactions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    externalId: (0, pg_core_1.varchar)('external_id', { length: 100 }).unique(), // Processor transaction ID
    platformId: (0, pg_core_1.varchar)('platform_id', { length: 50 }).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').notNull(),
    creatorId: (0, pg_core_1.uuid)('creator_id'),
    midId: (0, pg_core_1.uuid)('mid_id').references(() => exports.merchantAccounts.id),
    processorId: (0, pg_core_1.uuid)('processor_id').notNull().references(() => exports.paymentProcessors.id),
    // Financial Details
    amount: (0, pg_core_1.decimal)('amount', { precision: 15, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    fees: (0, pg_core_1.decimal)('fees', { precision: 15, scale: 2 }).notNull().default('0.00'),
    netAmount: (0, pg_core_1.decimal)('net_amount', { precision: 15, scale: 2 }).notNull(),
    // Transaction Details
    type: (0, pg_core_1.varchar)('type', { length: 50 }).notNull(), // subscription, tip, ppv, merchandise, etc.
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'), // pending, authorized, captured, failed, refunded
    paymentMethod: (0, pg_core_1.varchar)('payment_method', { length: 50 }).notNull(), // card, crypto, bank, wallet
    // Risk & Trust
    trustScore: (0, pg_core_1.integer)('trust_score'), // 0-100
    riskFlags: (0, pg_core_1.json)('risk_flags').$type().notNull().default([]),
    fraudSignals: (0, pg_core_1.json)('fraud_signals').$type().notNull().default({}),
    // Metadata
    metadata: (0, pg_core_1.json)('metadata').$type().notNull().default({}),
    processorResponse: (0, pg_core_1.json)('processor_response').$type().notNull().default({}),
    // Timestamps
    initiatedAt: (0, pg_core_1.timestamp)('initiated_at').notNull().defaultNow(),
    authorizedAt: (0, pg_core_1.timestamp)('authorized_at'),
    capturedAt: (0, pg_core_1.timestamp)('captured_at'),
    failedAt: (0, pg_core_1.timestamp)('failed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    platformUserIdx: (0, pg_core_1.index)('transactions_platform_user_idx').on(table.platformId, table.userId),
    creatorIdx: (0, pg_core_1.index)('transactions_creator_idx').on(table.creatorId),
    statusIdx: (0, pg_core_1.index)('transactions_status_idx').on(table.status),
    processorIdx: (0, pg_core_1.index)('transactions_processor_idx').on(table.processorId),
    midIdx: (0, pg_core_1.index)('transactions_mid_idx').on(table.midId),
    externalIdIdx: (0, pg_core_1.index)('transactions_external_id_idx').on(table.externalId),
    typeIdx: (0, pg_core_1.index)('transactions_type_idx').on(table.type),
    createdAtIdx: (0, pg_core_1.index)('transactions_created_at_idx').on(table.createdAt),
    trustScoreIdx: (0, pg_core_1.index)('transactions_trust_score_idx').on(table.trustScore),
}));
exports.transactionEvents = (0, pg_core_1.pgTable)('transaction_events', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    transactionId: (0, pg_core_1.uuid)('transaction_id').notNull().references(() => exports.transactions.id),
    eventType: (0, pg_core_1.varchar)('event_type', { length: 50 }).notNull(), // auth, capture, refund, dispute, settlement
    eventSource: (0, pg_core_1.varchar)('event_source', { length: 50 }).notNull(), // processor, internal, webhook
    eventData: (0, pg_core_1.json)('event_data').$type().notNull().default({}),
    processorEventId: (0, pg_core_1.varchar)('processor_event_id', { length: 100 }),
    amount: (0, pg_core_1.decimal)('amount', { precision: 15, scale: 2 }),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }),
    success: (0, pg_core_1.boolean)('success').notNull().default(true),
    errorCode: (0, pg_core_1.varchar)('error_code', { length: 50 }),
    errorMessage: (0, pg_core_1.text)('error_message'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
}, (table) => ({
    transactionIdx: (0, pg_core_1.index)('transaction_events_transaction_idx').on(table.transactionId),
    typeIdx: (0, pg_core_1.index)('transaction_events_type_idx').on(table.eventType),
    sourceIdx: (0, pg_core_1.index)('transaction_events_source_idx').on(table.eventSource),
    createdAtIdx: (0, pg_core_1.index)('transaction_events_created_at_idx').on(table.createdAt),
}));
// ========================================
// REFUNDS & DISPUTES
// ========================================
exports.refunds = (0, pg_core_1.pgTable)('refunds', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    transactionId: (0, pg_core_1.uuid)('transaction_id').notNull().references(() => exports.transactions.id),
    externalRefundId: (0, pg_core_1.varchar)('external_refund_id', { length: 100 }),
    amount: (0, pg_core_1.decimal)('amount', { precision: 15, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    reason: (0, pg_core_1.varchar)('reason', { length: 100 }).notNull(),
    reasonDetails: (0, pg_core_1.text)('reason_details'),
    origin: (0, pg_core_1.varchar)('origin', { length: 20 }).notNull(), // auto, manual, appeal, chargeback
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'), // pending, approved, denied, processed, failed
    // FanzTrust Integration
    trustVerificationId: (0, pg_core_1.uuid)('trust_verification_id'),
    trustScore: (0, pg_core_1.integer)('trust_score'),
    // Approval Workflow
    requestedBy: (0, pg_core_1.uuid)('requested_by').notNull(),
    reviewedBy: (0, pg_core_1.uuid)('reviewed_by'),
    approvedBy: (0, pg_core_1.uuid)('approved_by'),
    decisionReason: (0, pg_core_1.text)('decision_reason'),
    // Evidence & Documentation
    evidence: (0, pg_core_1.json)('evidence').$type().notNull().default({}),
    // Creator Impact
    creatorNotified: (0, pg_core_1.boolean)('creator_notified').notNull().default(false),
    creatorResponse: (0, pg_core_1.json)('creator_response').$type().notNull().default({}),
    // Processing
    processorResponse: (0, pg_core_1.json)('processor_response').$type().notNull().default({}),
    ledgerEntryId: (0, pg_core_1.varchar)('ledger_entry_id', { length: 100 }),
    // Timestamps
    requestedAt: (0, pg_core_1.timestamp)('requested_at').notNull().defaultNow(),
    reviewedAt: (0, pg_core_1.timestamp)('reviewed_at'),
    approvedAt: (0, pg_core_1.timestamp)('approved_at'),
    processedAt: (0, pg_core_1.timestamp)('processed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    transactionIdx: (0, pg_core_1.index)('refunds_transaction_idx').on(table.transactionId),
    statusIdx: (0, pg_core_1.index)('refunds_status_idx').on(table.status),
    originIdx: (0, pg_core_1.index)('refunds_origin_idx').on(table.origin),
    requestedByIdx: (0, pg_core_1.index)('refunds_requested_by_idx').on(table.requestedBy),
    createdAtIdx: (0, pg_core_1.index)('refunds_created_at_idx').on(table.createdAt),
}));
exports.disputes = (0, pg_core_1.pgTable)('disputes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    transactionId: (0, pg_core_1.uuid)('transaction_id').notNull().references(() => exports.transactions.id),
    externalDisputeId: (0, pg_core_1.varchar)('external_dispute_id', { length: 100 }).notNull(),
    type: (0, pg_core_1.varchar)('type', { length: 50 }).notNull(), // chargeback, retrieval, pre_arbitration, arbitration
    stage: (0, pg_core_1.varchar)('stage', { length: 50 }).notNull(), // initial, response_due, pre_arbitration, arbitration, closed
    amount: (0, pg_core_1.decimal)('amount', { precision: 15, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    reasonCode: (0, pg_core_1.varchar)('reason_code', { length: 20 }).notNull(),
    reasonDescription: (0, pg_core_1.text)('reason_description'),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('open'),
    // Important Dates
    deadlineAt: (0, pg_core_1.timestamp)('deadline_at'),
    receivedAt: (0, pg_core_1.timestamp)('received_at').notNull(),
    respondedAt: (0, pg_core_1.timestamp)('responded_at'),
    resolvedAt: (0, pg_core_1.timestamp)('resolved_at'),
    // Response Details
    responseSubmitted: (0, pg_core_1.boolean)('response_submitted').notNull().default(false),
    responseEvidence: (0, pg_core_1.json)('response_evidence').$type().notNull().default({}),
    // Outcome
    outcome: (0, pg_core_1.varchar)('outcome', { length: 50 }), // won, lost, accepted, partial
    recoveredAmount: (0, pg_core_1.decimal)('recovered_amount', { precision: 15, scale: 2 }),
    // Processing
    processorData: (0, pg_core_1.json)('processor_data').$type().notNull().default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    transactionIdx: (0, pg_core_1.index)('disputes_transaction_idx').on(table.transactionId),
    statusIdx: (0, pg_core_1.index)('disputes_status_idx').on(table.status),
    stageIdx: (0, pg_core_1.index)('disputes_stage_idx').on(table.stage),
    typeIdx: (0, pg_core_1.index)('disputes_type_idx').on(table.type),
    deadlineIdx: (0, pg_core_1.index)('disputes_deadline_idx').on(table.deadlineAt),
    createdAtIdx: (0, pg_core_1.index)('disputes_created_at_idx').on(table.createdAt),
}));
// ========================================
// SETTLEMENTS & RECONCILIATION
// ========================================
exports.settlements = (0, pg_core_1.pgTable)('settlements', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    processorId: (0, pg_core_1.uuid)('processor_id').notNull().references(() => exports.paymentProcessors.id),
    batchId: (0, pg_core_1.varchar)('batch_id', { length: 100 }).notNull(),
    settlementDate: (0, pg_core_1.timestamp)('settlement_date').notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    // Amounts
    grossAmount: (0, pg_core_1.decimal)('gross_amount', { precision: 15, scale: 2 }).notNull(),
    fees: (0, pg_core_1.decimal)('fees', { precision: 15, scale: 2 }).notNull(),
    chargebacks: (0, pg_core_1.decimal)('chargebacks', { precision: 15, scale: 2 }).notNull().default('0.00'),
    refunds: (0, pg_core_1.decimal)('refunds', { precision: 15, scale: 2 }).notNull().default('0.00'),
    netAmount: (0, pg_core_1.decimal)('net_amount', { precision: 15, scale: 2 }).notNull(),
    // Processing
    transactionCount: (0, pg_core_1.integer)('transaction_count').notNull().default(0),
    fileUrl: (0, pg_core_1.varchar)('file_url', { length: 500 }),
    fileHash: (0, pg_core_1.varchar)('file_hash', { length: 64 }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'), // pending, processed, reconciled, disputed
    // Reconciliation
    reconciledAt: (0, pg_core_1.timestamp)('reconciled_at'),
    reconciledBy: (0, pg_core_1.uuid)('reconciled_by'),
    discrepancies: (0, pg_core_1.json)('discrepancies').$type().notNull().default({}),
    // Ledger Integration
    ledgerEntryId: (0, pg_core_1.varchar)('ledger_entry_id', { length: 100 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    processorIdx: (0, pg_core_1.index)('settlements_processor_idx').on(table.processorId),
    batchIdx: (0, pg_core_1.index)('settlements_batch_idx').on(table.batchId),
    dateIdx: (0, pg_core_1.index)('settlements_date_idx').on(table.settlementDate),
    statusIdx: (0, pg_core_1.index)('settlements_status_idx').on(table.status),
}));
// ========================================
// PAYOUTS & CREATOR EARNINGS
// ========================================
exports.payoutMethods = (0, pg_core_1.pgTable)('payout_methods', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    displayName: (0, pg_core_1.varchar)('display_name', { length: 255 }).notNull(),
    type: (0, pg_core_1.varchar)('type', { length: 50 }).notNull(), // paxum, epayservice, wise, bank, crypto
    rails: (0, pg_core_1.json)('rails').$type().notNull().default([]),
    currencies: (0, pg_core_1.json)('currencies').$type().notNull().default([]),
    regions: (0, pg_core_1.json)('regions').$type().notNull().default([]),
    fees: (0, pg_core_1.json)('fees').$type().notNull().default({}),
    limits: (0, pg_core_1.json)('limits').$type().notNull().default({}),
    processingTime: (0, pg_core_1.varchar)('processing_time', { length: 100 }), // "1-2 business days"
    requirements: (0, pg_core_1.json)('requirements').$type().notNull().default({}),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    typeIdx: (0, pg_core_1.index)('payout_methods_type_idx').on(table.type),
    activeIdx: (0, pg_core_1.index)('payout_methods_active_idx').on(table.isActive),
}));
exports.payouts = (0, pg_core_1.pgTable)('payouts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    creatorId: (0, pg_core_1.uuid)('creator_id').notNull(),
    batchId: (0, pg_core_1.uuid)('batch_id'),
    payoutMethodId: (0, pg_core_1.uuid)('payout_method_id').notNull().references(() => exports.payoutMethods.id),
    // Financial Details
    amount: (0, pg_core_1.decimal)('amount', { precision: 15, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    fees: (0, pg_core_1.decimal)('fees', { precision: 15, scale: 2 }).notNull().default('0.00'),
    netAmount: (0, pg_core_1.decimal)('net_amount', { precision: 15, scale: 2 }).notNull(),
    // Status & Processing
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'), // pending, approved, sent, completed, failed, cancelled
    externalPayoutId: (0, pg_core_1.varchar)('external_payout_id', { length: 100 }),
    failureReason: (0, pg_core_1.text)('failure_reason'),
    // Creator Information
    creatorPayoutInfo: (0, pg_core_1.json)('creator_payout_info').$type().notNull().default({}),
    // Approval Workflow
    requestedBy: (0, pg_core_1.uuid)('requested_by'),
    approvedBy: (0, pg_core_1.uuid)('approved_by'),
    approvedAt: (0, pg_core_1.timestamp)('approved_at'),
    // Processing Details
    processorResponse: (0, pg_core_1.json)('processor_response').$type().notNull().default({}),
    // Tax & Compliance
    taxWithholding: (0, pg_core_1.decimal)('tax_withholding', { precision: 15, scale: 2 }).notNull().default('0.00'),
    taxYear: (0, pg_core_1.integer)('tax_year'),
    form1099Generated: (0, pg_core_1.boolean)('form_1099_generated').notNull().default(false),
    // Ledger Integration
    ledgerEntryId: (0, pg_core_1.varchar)('ledger_entry_id', { length: 100 }),
    // Timestamps
    requestedAt: (0, pg_core_1.timestamp)('requested_at').notNull().defaultNow(),
    sentAt: (0, pg_core_1.timestamp)('sent_at'),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    creatorIdx: (0, pg_core_1.index)('payouts_creator_idx').on(table.creatorId),
    statusIdx: (0, pg_core_1.index)('payouts_status_idx').on(table.status),
    batchIdx: (0, pg_core_1.index)('payouts_batch_idx').on(table.batchId),
    methodIdx: (0, pg_core_1.index)('payouts_method_idx').on(table.payoutMethodId),
    createdAtIdx: (0, pg_core_1.index)('payouts_created_at_idx').on(table.createdAt),
}));
exports.payoutBatches = (0, pg_core_1.pgTable)('payout_batches', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    batchNumber: (0, pg_core_1.varchar)('batch_number', { length: 50 }).notNull().unique(),
    payoutMethodId: (0, pg_core_1.uuid)('payout_method_id').notNull().references(() => exports.payoutMethods.id),
    // Batch Details
    payoutCount: (0, pg_core_1.integer)('payout_count').notNull().default(0),
    totalAmount: (0, pg_core_1.decimal)('total_amount', { precision: 15, scale: 2 }).notNull(),
    totalFees: (0, pg_core_1.decimal)('total_fees', { precision: 15, scale: 2 }).notNull(),
    netAmount: (0, pg_core_1.decimal)('net_amount', { precision: 15, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    // Processing
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'),
    fileUrl: (0, pg_core_1.varchar)('file_url', { length: 500 }),
    externalBatchId: (0, pg_core_1.varchar)('external_batch_id', { length: 100 }),
    // Workflow
    createdBy: (0, pg_core_1.uuid)('created_by').notNull(),
    approvedBy: (0, pg_core_1.uuid)('approved_by'),
    approvedAt: (0, pg_core_1.timestamp)('approved_at'),
    submittedAt: (0, pg_core_1.timestamp)('submitted_at'),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    batchNumberIdx: (0, pg_core_1.index)('payout_batches_batch_number_idx').on(table.batchNumber),
    statusIdx: (0, pg_core_1.index)('payout_batches_status_idx').on(table.status),
    methodIdx: (0, pg_core_1.index)('payout_batches_method_idx').on(table.payoutMethodId),
    createdAtIdx: (0, pg_core_1.index)('payout_batches_created_at_idx').on(table.createdAt),
}));
// ========================================
// FANZTRUST™ VERIFICATION & RISK SCORING
// ========================================
exports.trustScores = (0, pg_core_1.pgTable)('trust_scores', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    transactionId: (0, pg_core_1.uuid)('transaction_id').references(() => exports.transactions.id),
    userId: (0, pg_core_1.uuid)('user_id').notNull(),
    entityType: (0, pg_core_1.varchar)('entity_type', { length: 20 }).notNull(), // transaction, user, refund_request
    entityId: (0, pg_core_1.varchar)('entity_id', { length: 100 }).notNull(),
    // Scoring
    score: (0, pg_core_1.integer)('score').notNull(), // 0-100
    confidence: (0, pg_core_1.integer)('confidence').notNull(), // 0-100
    modelVersion: (0, pg_core_1.varchar)('model_version', { length: 20 }).notNull(),
    // Decision
    decision: (0, pg_core_1.varchar)('decision', { length: 20 }).notNull(), // allow, challenge, block, refund
    reasonCodes: (0, pg_core_1.json)('reason_codes').$type().notNull().default([]),
    // Signals Used
    signals: (0, pg_core_1.json)('signals').$type().notNull().default({}),
    // Explanation
    explanation: (0, pg_core_1.json)('explanation').$type().notNull().default({}),
    // Processing Details
    processingTimeMs: (0, pg_core_1.integer)('processing_time_ms'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
}, (table) => ({
    transactionIdx: (0, pg_core_1.index)('trust_scores_transaction_idx').on(table.transactionId),
    userIdx: (0, pg_core_1.index)('trust_scores_user_idx').on(table.userId),
    entityIdx: (0, pg_core_1.index)('trust_scores_entity_idx').on(table.entityType, table.entityId),
    scoreIdx: (0, pg_core_1.index)('trust_scores_score_idx').on(table.score),
    decisionIdx: (0, pg_core_1.index)('trust_scores_decision_idx').on(table.decision),
    createdAtIdx: (0, pg_core_1.index)('trust_scores_created_at_idx').on(table.createdAt),
}));
// ========================================
// APPROVALS WORKFLOW
// ========================================
exports.approvals = (0, pg_core_1.pgTable)('approvals', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    entityType: (0, pg_core_1.varchar)('entity_type', { length: 50 }).notNull(), // transaction, refund, payout, routing_rule
    entityId: (0, pg_core_1.uuid)('entity_id').notNull(),
    approvalType: (0, pg_core_1.varchar)('approval_type', { length: 50 }).notNull(), // high_risk_transaction, refund_request, large_payout
    // Current State
    state: (0, pg_core_1.varchar)('state', { length: 20 }).notNull().default('pending'), // pending, approved, denied, escalated, expired
    priority: (0, pg_core_1.varchar)('priority', { length: 10 }).notNull().default('medium'), // low, medium, high, urgent
    // Assignment
    assigneeId: (0, pg_core_1.uuid)('assignee_id'),
    assignedTeam: (0, pg_core_1.varchar)('assigned_team', { length: 50 }),
    // SLA
    slaMinutes: (0, pg_core_1.integer)('sla_minutes').notNull().default(240), // 4 hours default
    slaAt: (0, pg_core_1.timestamp)('sla_at').notNull(),
    escalatedAt: (0, pg_core_1.timestamp)('escalated_at'),
    // Request Details
    requestedBy: (0, pg_core_1.uuid)('requested_by').notNull(),
    requestReason: (0, pg_core_1.text)('request_reason'),
    requestData: (0, pg_core_1.json)('request_data').$type().notNull().default({}),
    // Decision
    decidedBy: (0, pg_core_1.uuid)('decided_by'),
    decidedAt: (0, pg_core_1.timestamp)('decided_at'),
    decision: (0, pg_core_1.varchar)('decision', { length: 20 }), // approved, denied
    decisionReason: (0, pg_core_1.text)('decision_reason'),
    decisionData: (0, pg_core_1.json)('decision_data').$type().notNull().default({}),
    // Audit Trail
    history: (0, pg_core_1.json)('history').$type().notNull().default([]),
    // Notifications
    notificationsSent: (0, pg_core_1.json)('notifications_sent').$type().notNull().default([]),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    entityIdx: (0, pg_core_1.index)('approvals_entity_idx').on(table.entityType, table.entityId),
    stateIdx: (0, pg_core_1.index)('approvals_state_idx').on(table.state),
    assigneeIdx: (0, pg_core_1.index)('approvals_assignee_idx').on(table.assigneeId),
    priorityIdx: (0, pg_core_1.index)('approvals_priority_idx').on(table.priority),
    slaIdx: (0, pg_core_1.index)('approvals_sla_idx').on(table.slaAt),
    createdAtIdx: (0, pg_core_1.index)('approvals_created_at_idx').on(table.createdAt),
}));
// ========================================
// FINANCIAL AUDIT TRAIL
// ========================================
exports.financialAuditTrail = (0, pg_core_1.pgTable)('financial_audit_trail', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    // Actor Information
    actorType: (0, pg_core_1.varchar)('actor_type', { length: 20 }).notNull(), // user, system, processor
    actorId: (0, pg_core_1.varchar)('actor_id', { length: 100 }).notNull(),
    actorName: (0, pg_core_1.varchar)('actor_name', { length: 255 }),
    // Action Details
    action: (0, pg_core_1.varchar)('action', { length: 100 }).notNull(),
    category: (0, pg_core_1.varchar)('category', { length: 50 }).notNull(), // payment, payout, refund, dispute, routing
    // Entity Information
    entityType: (0, pg_core_1.varchar)('entity_type', { length: 50 }).notNull(),
    entityId: (0, pg_core_1.varchar)('entity_id', { length: 100 }).notNull(),
    // Change Details
    beforeState: (0, pg_core_1.json)('before_state').$type().notNull().default({}),
    afterState: (0, pg_core_1.json)('after_state').$type().notNull().default({}),
    // Context
    platformId: (0, pg_core_1.varchar)('platform_id', { length: 50 }),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 100 }),
    requestId: (0, pg_core_1.varchar)('request_id', { length: 100 }),
    // Network Information
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    userAgent: (0, pg_core_1.text)('user_agent'),
    geoLocation: (0, pg_core_1.json)('geo_location').$type().notNull().default({}),
    // Risk & Compliance
    riskLevel: (0, pg_core_1.varchar)('risk_level', { length: 10 }).notNull().default('low'),
    complianceFlags: (0, pg_core_1.json)('compliance_flags').$type().notNull().default([]),
    // Additional Context
    metadata: (0, pg_core_1.json)('metadata').$type().notNull().default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
}, (table) => ({
    actorIdx: (0, pg_core_1.index)('financial_audit_trail_actor_idx').on(table.actorType, table.actorId),
    actionIdx: (0, pg_core_1.index)('financial_audit_trail_action_idx').on(table.action),
    categoryIdx: (0, pg_core_1.index)('financial_audit_trail_category_idx').on(table.category),
    entityIdx: (0, pg_core_1.index)('financial_audit_trail_entity_idx').on(table.entityType, table.entityId),
    platformIdx: (0, pg_core_1.index)('financial_audit_trail_platform_idx').on(table.platformId),
    createdAtIdx: (0, pg_core_1.index)('financial_audit_trail_created_at_idx').on(table.createdAt),
    riskIdx: (0, pg_core_1.index)('financial_audit_trail_risk_idx').on(table.riskLevel),
}));
// ========================================
// FINANCIAL PRODUCT CONFIGURATIONS
// ========================================
exports.financialProducts = (0, pg_core_1.pgTable)('financial_products', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    productType: (0, pg_core_1.varchar)('product_type', { length: 50 }).notNull(), // fanzpay, fanzmoney, fanztoken, fanzcard, fanzrev, fanzcredit
    productName: (0, pg_core_1.varchar)('product_name', { length: 100 }).notNull(),
    displayName: (0, pg_core_1.varchar)('display_name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    // Configuration
    configuration: (0, pg_core_1.json)('configuration').$type().notNull().default({}),
    // Platform Availability
    enabledPlatforms: (0, pg_core_1.json)('enabled_platforms').$type().notNull().default([]),
    regionAvailability: (0, pg_core_1.json)('region_availability').$type().notNull().default([]),
    // Feature Flags
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    isBeta: (0, pg_core_1.boolean)('is_beta').notNull().default(false),
    rolloutPercentage: (0, pg_core_1.integer)('rollout_percentage').notNull().default(100),
    // Limits & Rules
    limits: (0, pg_core_1.json)('limits').$type().notNull().default({}),
    rules: (0, pg_core_1.json)('rules').$type().notNull().default({}),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    productTypeIdx: (0, pg_core_1.index)('financial_products_type_idx').on(table.productType),
    activeIdx: (0, pg_core_1.index)('financial_products_active_idx').on(table.isActive),
    betaIdx: (0, pg_core_1.index)('financial_products_beta_idx').on(table.isBeta),
}));
// ========================================
// RELATIONSHIPS & FOREIGN KEYS
// ========================================
// Add foreign key relationships as needed based on your existing schema
// These would connect to your existing users, platforms, and other tables
// Export all tables for use in Drizzle queries
exports.financialSchema = {
    // Core Financial Infrastructure
    paymentProcessors: exports.paymentProcessors,
    merchantAccounts: exports.merchantAccounts,
    routingRules: exports.routingRules,
    // Transactions
    transactions: exports.transactions,
    transactionEvents: exports.transactionEvents,
    // Refunds & Disputes
    refunds: exports.refunds,
    disputes: exports.disputes,
    // Settlements
    settlements: exports.settlements,
    // Payouts
    payoutMethods: exports.payoutMethods,
    payouts: exports.payouts,
    payoutBatches: exports.payoutBatches,
    // FanzTrust™
    trustScores: exports.trustScores,
    // Workflow
    approvals: exports.approvals,
    // Audit
    financialAuditTrail: exports.financialAuditTrail,
    // Products
    financialProducts: exports.financialProducts,
};
//# sourceMappingURL=financial-schema.js.map
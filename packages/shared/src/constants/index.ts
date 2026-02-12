// ============ API Constants ============

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// ============ Auth Constants ============

export const SESSION_DURATION_HOURS = 24 * 7; // 7 days
export const MIN_PASSWORD_LENGTH = 8;

// ============ Content Constants ============

export const MAX_CONTENT_SIZE_BYTES = 1024 * 1024; // 1MB
export const MAX_BLOCKS_PER_TEST = 100;
export const MAX_BLOCK_CONTENT_LENGTH = 10000;

// ============ Attachment Constants ============

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
];

// ============ Result Status ============

export const RESULT_STATUSES = ['passed', 'failed', 'blocked', 'skipped', 'retest', 'untested'] as const;

export const RESULT_STATUS_COLORS: Record<string, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  blocked: '#f59e0b',
  skipped: '#6b7280',
  retest: '#8b5cf6',
  untested: '#d1d5db',
};

// ============ Run Status ============

export const RUN_STATUSES = ['active', 'completed', 'archived'] as const;

// ============ Block Types ============

export const BLOCK_TYPES = ['step', 'expected', 'note', 'precondition', 'table', 'attachment'] as const;

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  step: 'Step',
  expected: 'Expected Result',
  note: 'Note',
  precondition: 'Precondition',
  table: 'Table',
  attachment: 'Attachment',
};

// ============ Workspace Roles ============

export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;

export const WORKSPACE_ROLE_PERMISSIONS = {
  owner: ['read', 'write', 'delete', 'manage_members', 'delete_workspace'],
  admin: ['read', 'write', 'delete', 'manage_members'],
  member: ['read', 'write'],
} as const;

// ============ Audit Actions ============

export const AUDIT_ACTIONS = [
  'test.created',
  'test.updated',
  'test.deleted',
  'test.versionCreated',
  'suite.created',
  'suite.updated',
  'suite.deleted',
  'suite.moved',
  'run.created',
  'run.completed',
  'result.created',
  'project.exported',
  'project.imported',
] as const;

// ============ Webhook Events ============

export const WEBHOOK_EVENTS = [
  'test.created',
  'test.versionCreated',
  'suite.created',
  'suite.moved',
  'run.created',
  'run.completed',
  'result.created',
] as const;

// ============ Export Schema Version ============

export const EXPORT_SCHEMA_VERSION = '1.0.0';

// ============ Tag Colors ============

export const DEFAULT_TAG_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

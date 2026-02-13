// ============ API Response Types ============

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

// ============ Bulk Operation Types ============

export interface BulkFailure {
  id?: string;
  index?: number;
  error: string;
  message: string;
}

export interface BulkResult<T> {
  succeeded: T[];
  failed: BulkFailure[];
}

// ============ Auth Types ============

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// ============ Content Block Types ============

export type BlockType = 'step' | 'expected' | 'note' | 'precondition' | 'table' | 'attachment';

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface TestContent {
  description?: string;
  blocks: ContentBlock[];
}

// ============ Workspace & Project Types ============

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  user: AuthUser;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============ Suite Types ============

export interface SuiteNode {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  orderKey: string;
  children?: SuiteNode[];
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SuiteItem {
  id: string;
  suiteNodeId: string;
  testId: string;
  orderKey: string;
  test?: TestSummary;
  createdAt: string;
}

// ============ Test Types ============

export interface TestSummary {
  id: string;
  projectId: string;
  code: string;
  title: string;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Test extends TestSummary {
  currentVersion: TestVersion | null;
}

export interface TestVersion {
  id: string;
  testId: string;
  version: number;
  title: string;
  content: TestContent;
  contentHash: string;
  source: 'human' | 'ai' | 'import';
  createdBy: AuthUser;
  createdAt: string;
}

export interface TestDiff {
  version1: number;
  version2: number;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  blockId: string;
  oldValue?: ContentBlock;
  newValue?: ContentBlock;
}

// ============ Tag Types ============

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
}

// ============ Run Types ============

export type RunStatus = 'active' | 'completed' | 'archived';
export type ResultStatus = 'passed' | 'failed' | 'blocked' | 'skipped' | 'retest' | 'untested';

export interface Run {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: RunStatus;
  createdBy: AuthUser;
  createdAt: string;
  completedAt: string | null;
  stats?: RunStats;
}

export interface RunStats {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  retest: number;
  untested: number;
}

export interface RunItem {
  id: string;
  runId: string;
  testVersionId: string;
  orderIndex: number;
  testVersion: TestVersion;
  result: Result | null;
  createdAt: string;
}

export interface Result {
  id: string;
  runItemId: string;
  status: ResultStatus;
  notes: string | null;
  duration: number | null;
  recordedBy: AuthUser;
  recordedAt: string;
  attachments: Attachment[];
}

export interface RunItemWithTest extends RunItem {
  testVersion: TestVersion & {
    test: { id: string; code: string };
  };
}

export interface RunDetail extends Run {
  items: RunItemWithTest[];
  stats: RunStats;
}

export interface WorkspaceRun extends Run {
  project: { id: string; name: string; slug: string };
}

// ============ Attachment Types ============

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  createdAt: string;
}

// ============ Audit Log Types ============

export type AuditAction =
  | 'test.created'
  | 'test.updated'
  | 'test.deleted'
  | 'test.versionCreated'
  | 'suite.created'
  | 'suite.updated'
  | 'suite.deleted'
  | 'suite.moved'
  | 'run.created'
  | 'run.completed'
  | 'result.created'
  | 'project.exported'
  | 'project.imported';

export interface AuditLog {
  id: string;
  projectId: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  user: AuthUser | null;
  createdAt: string;
}

// ============ Webhook Types ============

export interface Webhook {
  id: string;
  projectId: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Export/Import Types ============

export interface ExportSchema {
  version: string;
  exportedAt: string;
  project: {
    name: string;
    slug: string;
    description: string | null;
  };
  suites: ExportSuiteNode[];
  tests: ExportTest[];
  tags: ExportTag[];
}

export interface ExportSuiteNode {
  id: string;
  parentId: string | null;
  name: string;
  order: number;
  testIds: string[];
}

export interface ExportTest {
  id: string;
  code: string;
  title: string;
  content: TestContent;
  tags: string[];
}

export interface ExportTag {
  id: string;
  name: string;
  color: string;
}

// ============ Import Types ============

export interface ImportOptions {
  mode: 'merge' | 'replace';
  conflictResolution: {
    tests: 'skip' | 'overwrite' | 'create_new';
    suites: 'skip' | 'overwrite' | 'create_new';
    tags: 'skip' | 'overwrite';
  };
  dryRun?: boolean;
}

export interface EntityImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

export interface ImportResult {
  summary: {
    suites: EntityImportSummary;
    tests: EntityImportSummary;
    tags: EntityImportSummary;
  };
  mappings: {
    suites: Record<string, string>;
    tests: Record<string, string>;
    tags: Record<string, string>;
  };
  warnings: string[];
}

export interface EntityPreview {
  toCreate: string[];
  toUpdate: string[];
  toSkip: string[];
  conflicts: string[];
}

export interface ImportPreview {
  valid: boolean;
  preview: {
    suites: EntityPreview;
    tests: EntityPreview;
    tags: EntityPreview;
  };
  errors: string[];
  warnings: string[];
}

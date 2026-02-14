import { useAuthStore } from '@/stores/auth';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'An error occurred' },
    }));
    throw new ApiError(
      response.status,
      error.error?.code || 'UNKNOWN',
      error.error?.message || 'An error occurred'
    );
  }
  return response.json();
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = useAuthStore.getState().token;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },
};

// Auth API
export const authApi = {
  async login(email: string, password: string) {
    return api.post<{
      data: {
        user: { id: string; email: string; name: string; avatarUrl: string | null };
        session: { token: string; expiresAt: string };
      };
    }>('/auth/login', { email, password });
  },

  async register(email: string, password: string, name: string) {
    return api.post<{
      data: {
        user: { id: string; email: string; name: string; avatarUrl: string | null };
        session: { token: string; expiresAt: string };
      };
    }>('/auth/register', { email, password, name });
  },

  async logout() {
    return api.post<{ data: { success: boolean } }>('/auth/logout');
  },

  async me() {
    return api.get<{ data: { user: { id: string; email: string; name: string; avatarUrl: string | null } } }>(
      '/auth/me'
    );
  },
};

// Types
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  projectCount: number;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  testCount: number;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

// Workspace API
export interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
}

export const workspaceApi = {
  async list() {
    return api.get<{ data: Workspace[] }>('/workspaces');
  },

  async get(workspaceId: string) {
    return api.get<{ data: Workspace }>(`/workspaces/${workspaceId}`);
  },

  async listMembers(workspaceId: string) {
    return api.get<{ data: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`);
  },
};

// Project API
export const projectApi = {
  async list(workspaceId: string) {
    return api.get<{ data: Project[] }>(`/workspaces/${workspaceId}/projects`);
  },

  async get(workspaceId: string, projectId: string) {
    return api.get<{ data: Project }>(`/workspaces/${workspaceId}/projects/${projectId}`);
  },

  async create(workspaceId: string, data: { name: string; slug: string; description?: string }) {
    return api.post<{ data: Project }>(`/workspaces/${workspaceId}/projects`, data);
  },
};

// Suite Types
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

// Suite API
export const suiteApi = {
  async getTree(projectId: string) {
    return api.get<{ data: SuiteNode[] }>(`/projects/${projectId}/suites`);
  },

  async get(projectId: string, suiteId: string) {
    return api.get<{ data: SuiteNode }>(`/projects/${projectId}/suites/${suiteId}`);
  },

  async create(projectId: string, data: { name: string; parentId?: string | null; afterSuiteId?: string }) {
    return api.post<{ data: SuiteNode }>(`/projects/${projectId}/suites`, data);
  },

  async update(projectId: string, suiteId: string, data: { name: string }) {
    return api.patch<{ data: SuiteNode }>(`/projects/${projectId}/suites/${suiteId}`, data);
  },

  async move(projectId: string, suiteId: string, data: { parentId: string | null; afterSuiteId?: string }) {
    return api.post<{ data: SuiteNode }>(`/projects/${projectId}/suites/${suiteId}/move`, data);
  },

  async delete(projectId: string, suiteId: string) {
    return api.delete<{ data: { success: boolean; deletedCount: number } }>(`/projects/${projectId}/suites/${suiteId}`);
  },
};

// Tag Types
export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  testCount?: number;
  createdAt: string;
}

// Tag API
export const tagApi = {
  async list(projectId: string) {
    return api.get<{ data: Tag[] }>(`/projects/${projectId}/tags`);
  },

  async get(projectId: string, tagId: string) {
    return api.get<{ data: Tag }>(`/projects/${projectId}/tags/${tagId}`);
  },

  async create(projectId: string, data: { name: string; color?: string }) {
    return api.post<{ data: Tag }>(`/projects/${projectId}/tags`, data);
  },

  async update(projectId: string, tagId: string, data: { name?: string; color?: string }) {
    return api.patch<{ data: Tag }>(`/projects/${projectId}/tags/${tagId}`, data);
  },

  async delete(projectId: string, tagId: string) {
    return api.delete<{ data: { success: boolean } }>(`/projects/${projectId}/tags/${tagId}`);
  },

  async setTestTags(projectId: string, testId: string, tagIds: string[]) {
    return api.put<{ data: { tags: Tag[] } }>(`/projects/${projectId}/tags/test/${testId}`, { tagIds });
  },
};

// Test Types

export interface ContentBlock {
  id: string;
  type: 'step' | 'expected' | 'note' | 'precondition' | 'table' | 'attachment';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface TestContent {
  description?: string;
  blocks: ContentBlock[];
}

export interface TestVersion {
  id: string;
  testId: string;
  version: number;
  title: string;
  content: TestContent;
  contentHash: string;
  source: 'human' | 'ai' | 'import';
  createdBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  createdAt: string;
}

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

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  blockId?: string;
  field?: string;
  oldValue?: ContentBlock | string;
  newValue?: ContentBlock | string;
}

export interface TestDiff {
  version1: number;
  version2: number;
  changes: DiffChange[];
}

export interface GroupedTestsResponse {
  suites: Array<{ suiteId: string; tests: TestSummary[] }>;
  unassigned: TestSummary[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
  };
}

// Test API
export const testApi = {
  async list(projectId: string, options?: { suiteId?: string; search?: string; cursor?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.suiteId) params.set('suiteId', options.suiteId);
    if (options?.search) params.set('search', options.search);
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return api.get<PaginatedResponse<TestSummary>>(`/projects/${projectId}/tests${query ? `?${query}` : ''}`);
  },

  async get(projectId: string, testId: string) {
    return api.get<{ data: Test }>(`/projects/${projectId}/tests/${testId}`);
  },

  async create(projectId: string, data: { title: string; suiteId?: string; content?: TestContent; tags?: string[] }) {
    return api.post<{ data: Test }>(`/projects/${projectId}/tests`, data);
  },

  async getVersions(projectId: string, testId: string) {
    return api.get<{ data: TestVersion[] }>(`/projects/${projectId}/tests/${testId}/versions`);
  },

  async update(projectId: string, testId: string, data: {
    title: string;
    content: TestContent;
    source?: 'human' | 'ai' | 'import';
  }) {
    return api.patch<{ data: Test; noChange?: boolean }>(`/projects/${projectId}/tests/${testId}`, data);
  },

  async delete(projectId: string, testId: string) {
    return api.delete<{ data: TestSummary }>(`/projects/${projectId}/tests/${testId}`);
  },

  async diff(projectId: string, testId: string, v1: number, v2: number) {
    return api.get<{ data: TestDiff }>(`/projects/${projectId}/tests/${testId}/diff?v1=${v1}&v2=${v2}`);
  },

  async getGrouped(projectId: string) {
    return api.get<{ data: GroupedTestsResponse }>(`/projects/${projectId}/tests/grouped`);
  },

  async moveToSuite(projectId: string, testId: string, data: { targetSuiteId: string | null; afterTestId?: string }) {
    return api.post<{ data: TestSummary }>(`/projects/${projectId}/tests/${testId}/move`, data);
  },
};

// Run Types

export type RunStatus = 'active' | 'completed' | 'archived';
export type ResultStatus = 'passed' | 'failed' | 'blocked' | 'skipped' | 'retest' | 'untested';

export interface RunStats {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  retest: number;
  untested: number;
}

export interface Run {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: RunStatus;
  createdBy: { id: string; email: string; name: string; avatarUrl: string | null };
  assignedTo: { id: string; email: string; name: string; avatarUrl: string | null } | null;
  createdAt: string;
  completedAt: string | null;
  stats: RunStats;
}

export interface WorkspaceRun extends Run {
  project: { id: string; name: string; slug: string };
}

export interface RunItemDetail {
  id: string;
  runId: string;
  testVersionId: string;
  orderIndex: number;
  assignedTo: { id: string; email: string; name: string; avatarUrl: string | null } | null;
  testVersion: TestVersion & {
    test: { id: string; code: string };
  };
  result: ResultDetail | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface ResultDetail {
  id: string;
  runItemId: string;
  status: ResultStatus;
  notes: string | null;
  duration: number | null;
  recordedBy: { id: string; email: string; name: string; avatarUrl: string | null };
  recordedAt: string;
  attachments: Attachment[];
}

export interface RunDetail extends Run {
  items: RunItemDetail[];
}

export interface TestSelectionInput {
  mode: 'all' | 'suite' | 'tag' | 'manual';
  suiteIds?: string[];
  tagIds?: string[];
  testIds?: string[];
}

// Run API
export const runApi = {
  async listForWorkspace(workspaceId: string, options?: { status?: string; projectId?: string; cursor?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.projectId) params.set('projectId', options.projectId);
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return api.get<PaginatedResponse<WorkspaceRun>>(`/workspaces/${workspaceId}/runs${query ? `?${query}` : ''}`);
  },

  async list(projectId: string, options?: { status?: string; cursor?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return api.get<PaginatedResponse<Run>>(`/projects/${projectId}/runs${query ? `?${query}` : ''}`);
  },

  async get(projectId: string, runId: string) {
    return api.get<{ data: RunDetail }>(`/projects/${projectId}/runs/${runId}`);
  },

  async create(projectId: string, data: { title: string; description?: string; assignedToId?: string | null; selection: TestSelectionInput }) {
    return api.post<{ data: Run }>(`/projects/${projectId}/runs`, data);
  },

  async update(projectId: string, runId: string, data: { title?: string; description?: string | null; status?: RunStatus; assignedToId?: string | null }) {
    return api.patch<{ data: Run }>(`/projects/${projectId}/runs/${runId}`, data);
  },

  async delete(projectId: string, runId: string) {
    return api.delete<{ data: { success: boolean } }>(`/projects/${projectId}/runs/${runId}`);
  },

  async recordResult(projectId: string, runId: string, runItemId: string, data: { status: string; notes?: string | null; duration?: number | null; attachmentIds?: string[] }) {
    return api.put<{ data: ResultDetail }>(`/projects/${projectId}/runs/${runId}/items/${runItemId}/result`, data);
  },

  async clearResult(projectId: string, runId: string, runItemId: string) {
    return api.delete<{ data: { success: boolean } }>(`/projects/${projectId}/runs/${runId}/items/${runItemId}/result`);
  },

  async updateItem(projectId: string, runId: string, runItemId: string, data: { assignedToId: string | null }) {
    return api.patch<{ data: { success: boolean } }>(`/projects/${projectId}/runs/${runId}/items/${runItemId}`, data);
  },
};

// Attachment API
export const attachmentApi = {
  async upload(projectId: string, file: File): Promise<{ data: Attachment }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = useAuthStore.getState().token;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Do NOT set Content-Type — the browser sets it with the multipart boundary

    const response = await fetch(`${API_BASE}/projects/${projectId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return handleResponse<{ data: Attachment }>(response);
  },

  async delete(projectId: string, attachmentId: string) {
    return api.delete<{ data: { success: boolean } }>(`/projects/${projectId}/attachments/${attachmentId}`);
  },

  getDownloadUrl(attachmentId: string): string {
    return `${API_BASE}/attachments/${attachmentId}/download`;
  },
};

// Export/Import Types
export interface ExportSchema {
  version: string;
  exportedAt: string;
  project: {
    name: string;
    slug: string;
    description: string | null;
  };
  suites: Array<{
    id: string;
    parentId: string | null;
    name: string;
    order: number;
    testIds: string[];
  }>;
  tests: Array<{
    id: string;
    code: string;
    title: string;
    content: TestContent;
    tags: string[];
  }>;
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export interface ImportOptions {
  mode: 'merge' | 'replace';
  conflictResolution: {
    tests: 'skip' | 'overwrite' | 'create_new';
    suites: 'skip' | 'overwrite' | 'create_new';
    tags: 'skip' | 'overwrite';
  };
  dryRun?: boolean;
}

export interface ImportResult {
  summary: {
    suites: { created: number; updated: number; skipped: number };
    tests: { created: number; updated: number; skipped: number };
    tags: { created: number; updated: number; skipped: number };
  };
  mappings: {
    suites: Record<string, string>;
    tests: Record<string, string>;
    tags: Record<string, string>;
  };
  warnings: string[];
}

export interface ImportPreview {
  valid: boolean;
  preview: {
    suites: { toCreate: string[]; toUpdate: string[]; toSkip: string[]; conflicts: string[] };
    tests: { toCreate: string[]; toUpdate: string[]; toSkip: string[]; conflicts: string[] };
    tags: { toCreate: string[]; toUpdate: string[]; toSkip: string[]; conflicts: string[] };
  };
  errors: string[];
  warnings: string[];
}

// Export/Import API
export const exportApi = {
  async exportProject(projectId: string): Promise<ExportSchema> {
    const response = await fetch(`${API_BASE}/projects/${projectId}/export`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse<ExportSchema>(response);
  },

  async importProject(projectId: string, data: ExportSchema, options: ImportOptions) {
    return api.post<{ data: ImportResult }>(`/projects/${projectId}/import`, { data, options });
  },

  async previewImport(projectId: string, data: ExportSchema, options: Omit<ImportOptions, 'dryRun'>) {
    return api.post<{ data: ImportPreview }>(`/projects/${projectId}/import/preview`, {
      data,
      options: { ...options, dryRun: true }
    });
  },
};

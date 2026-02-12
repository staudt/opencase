/**
 * OpenCase API Client
 *
 * This package provides a typed client for the OpenCase API.
 *
 * Usage:
 * ```ts
 * import { createClient } from '@opencase/api-client';
 *
 * const client = createClient({
 *   baseUrl: 'http://localhost:3001/api',
 *   token: 'your-auth-token',
 * });
 *
 * const projects = await client.projects.list();
 * ```
 */

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  onUnauthorized?: () => void;
}

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

export function createClient(config: ClientConfig) {
  const { baseUrl, token, onUnauthorized } = config;

  async function request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; query?: Record<string, string> }
  ): Promise<T> {
    const url = new URL(path, baseUrl);
    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401 && onUnauthorized) {
        onUnauthorized();
      }

      const errorBody = await response.json().catch(() => ({
        error: { code: 'UNKNOWN', message: 'An error occurred' },
      })) as { error?: { code?: string; message?: string } };

      throw new ApiError(
        response.status,
        errorBody.error?.code || 'UNKNOWN',
        errorBody.error?.message || 'An error occurred'
      );
    }

    return response.json() as Promise<T>;
  }

  return {
    // Health
    health: {
      check: () => request<{ status: string; timestamp: string }>('GET', '/health'),
    },

    // Auth
    auth: {
      login: (email: string, password: string) =>
        request<{ data: { user: any; session: { token: string; expiresAt: string } } }>('POST', '/auth/login', {
          body: { email, password },
        }),
      register: (email: string, password: string, name: string) =>
        request<{ data: { user: any; session: { token: string; expiresAt: string } } }>('POST', '/auth/register', {
          body: { email, password, name },
        }),
      logout: () => request<{ data: { success: boolean } }>('POST', '/auth/logout'),
      me: () => request<{ data: { user: any } }>('GET', '/auth/me'),
    },

    // Workspaces
    workspaces: {
      list: () => request<{ data: any[] }>('GET', '/workspaces'),
      get: (slug: string) => request<{ data: any }>('GET', `/workspaces/${slug}`),
      create: (data: { name: string; slug: string }) =>
        request<{ data: any }>('POST', '/workspaces', { body: data }),
    },

    // Projects
    projects: {
      list: (workspaceSlug: string) =>
        request<{ data: any[] }>('GET', `/workspaces/${workspaceSlug}/projects`),
      get: (id: string) => request<{ data: any }>('GET', `/projects/${id}`),
      create: (workspaceSlug: string, data: { name: string; slug: string; description?: string }) =>
        request<{ data: any }>('POST', `/workspaces/${workspaceSlug}/projects`, { body: data }),
    },

    // Generic request for custom endpoints
    request,
  };
}

export type Client = ReturnType<typeof createClient>;

/**
 * VYENFITA API Client
 * 
 * Centralized HTTP client for VYENFITA AI backend
 * - JWT token management
 * - Auto refresh
 * - Error handling
 * - Type-safe responses
 * 
 * @version 1.0.0
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  meta?: Record<string, any>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface AuthResult {
  user: User;
  tenant: Tenant;
  role: Role;
  tokens: AuthTokens;
}

export interface Application {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  currentVersionId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// ERROR TYPES
// ============================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================
// API CLIENT
// ============================================================

const API_BASE_URL =
  (window as any).VYENFITA_API_URL ||
  process.env.REACT_APP_VYENFITA_API_URL ||
  'http://localhost:3001';

const ACCESS_TOKEN_KEY = 'vyenfita.accessToken';
const REFRESH_TOKEN_KEY = 'vyenfita.refreshToken';
const TENANT_ID_KEY = 'vyenfita.tenantId';

export class ApiClient {
  private static refreshPromise: Promise<AuthTokens> | null = null;

  // ============================================================
  // TOKEN MANAGEMENT
  // ============================================================

  static getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  static getTenantId(): string | null {
    return localStorage.getItem(TENANT_ID_KEY);
  }

  static setTokens(tokens: AuthTokens, tenantId: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(TENANT_ID_KEY, tenantId);
  }

  static clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
  }

  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // ============================================================
  // HTTP METHODS
  // ============================================================

  static async get<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  static async post<T = any>(
    path: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  static async put<T = any>(
    path: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  static async patch<T = any>(
    path: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  static async delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  // ============================================================
  // CORE REQUEST
  // ============================================================

  private static async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: RequestInit,
    isRetry: boolean = false
  ): Promise<T> {
    const url = `${API_BASE_URL}${path}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    };

    const accessToken = this.getAccessToken();
    if (accessToken) {
      (headers as any)['Authorization'] = `Bearer ${accessToken}`;
    }

    const tenantId = this.getTenantId();
    if (tenantId) {
      (headers as any)['X-Tenant-Id'] = tenantId;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });
    } catch (error) {
      throw new ApiError(
        'Network error: unable to reach server',
        0,
        'NETWORK_ERROR'
      );
    }

    // Handle 401 — try refresh (once)
    if (response.status === 401 && !isRetry && this.getRefreshToken()) {
      try {
        await this.refreshTokens();
        return this.request<T>(method, path, body, options, true);
      } catch {
        this.clearTokens();
        throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
      }
    }

    // Parse response
    let payload: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      throw new ApiError(
        payload?.error || `HTTP ${response.status}`,
        response.status,
        payload?.code,
        payload?.details
      );
    }

    return payload as T;
  }

  // ============================================================
  // TOKEN REFRESH
  // ============================================================

  private static async refreshTokens(): Promise<AuthTokens> {
    // Prevent concurrent refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new ApiError('No refresh token', 401, 'NO_REFRESH_TOKEN');
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Refresh failed');
        }

        const payload = await response.json();
        const tokens: AuthTokens = payload.data;

        const tenantId = this.getTenantId() || '';
        this.setTokens(tokens, tenantId);

        return tokens;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ============================================================
  // AUTH API
  // ============================================================

  static async register(params: {
    email: string;
    password: string;
    name: string;
    tenantName?: string;
  }): Promise<AuthResult> {
    const response = await this.post<ApiResponse<AuthResult>>(
      '/api/v1/auth/register',
      params
    );

    if (!response.success || !response.data) {
      throw new ApiError(response.error || 'Registration failed', 400);
    }

    this.setTokens(response.data.tokens, response.data.tenant.id);
    return response.data;
  }

  static async login(params: {
    email: string;
    password: string;
    tenantId: string;
  }): Promise<AuthResult> {
    const response = await this.post<ApiResponse<AuthResult>>(
      '/api/v1/auth/login',
      params
    );

    if (!response.success || !response.data) {
      throw new ApiError(response.error || 'Login failed', 401);
    }

    this.setTokens(response.data.tokens, response.data.tenant.id);
    return response.data;
  }

  static async logout(): Promise<void> {
    try {
      await this.post('/api/v1/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    this.clearTokens();
  }

  static async me(): Promise<{
    userId: string;
    email: string;
    tenantId: string;
    roleId: string;
    permissions: string[];
  }> {
    const response = await this.get<ApiResponse<any>>('/api/v1/auth/me');
    if (!response.success || !response.data) {
      throw new ApiError('Failed to get user info', 500);
    }
    return response.data;
  }

  // ============================================================
  // TENANT API
  // ============================================================

  static async getTenant(): Promise<Tenant> {
    const response = await this.get<ApiResponse<Tenant>>('/api/v1/tenant');
    if (!response.success || !response.data) {
      throw new ApiError('Failed to get tenant', 500);
    }
    return response.data;
  }

  static async getTenantStats(): Promise<any> {
    const response = await this.get<ApiResponse<any>>('/api/v1/tenant/stats');
    return response.data || {};
  }

  static async listMembers(): Promise<any[]> {
    const response = await this.get<ApiResponse<any[]>>('/api/v1/tenant/members');
    return response.data || [];
  }

  static async listRoles(): Promise<any[]> {
    const response = await this.get<ApiResponse<any[]>>('/api/v1/tenant/roles');
    return response.data || [];
  }

  static async inviteMember(email: string, roleId: string): Promise<any> {
    const response = await this.post<ApiResponse<any>>(
      '/api/v1/tenant/members/invite',
      { email, roleId }
    );
    if (!response.success) {
      throw new ApiError(response.error || 'Invite failed', 400);
    }
    return response.data;
  }

  // ============================================================
  // APPLICATION API
  // ============================================================

  static async listApplications(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Application[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const response = await this.get<any>(
      `/api/v1/applications?${query.toString()}`
    );
    return { data: response.data || [], pagination: response.pagination };
  }

  static async getApplication(id: string): Promise<Application> {
    const response = await this.get<ApiResponse<Application>>(
      `/api/v1/applications/${id}`
    );
    if (!response.success || !response.data) {
      throw new ApiError('Application not found', 404);
    }
    return response.data;
  }

  static async createApplication(params: {
    name: string;
    description?: string;
    spec: any;
    tags?: string[];
  }): Promise<Application> {
    const response = await this.post<ApiResponse<Application>>(
      '/api/v1/applications',
      params
    );
    if (!response.success || !response.data) {
      throw new ApiError(response.error || 'Create failed', 400);
    }
    return response.data;
  }

  static async updateApplication(
    id: string,
    params: Partial<{
      name: string;
      description: string;
      status: string;
      spec: any;
      tags: string[];
      changeLog: string;
    }>
  ): Promise<Application> {
    const response = await this.put<ApiResponse<Application>>(
      `/api/v1/applications/${id}`,
      params
    );
    if (!response.success || !response.data) {
      throw new ApiError(response.error || 'Update failed', 400);
    }
    return response.data;
  }

  static async deleteApplication(id: string): Promise<void> {
    const response = await this.delete<ApiResponse<any>>(
      `/api/v1/applications/${id}`
    );
    if (!response.success) {
      throw new ApiError(response.error || 'Delete failed', 400);
    }
  }

  static async getApplicationVersions(id: string): Promise<any[]> {
    const response = await this.get<ApiResponse<any[]>>(
      `/api/v1/applications/${id}/versions`
    );
    return response.data || [];
  }

  static async generateApplication(description: string): Promise<any> {
    const response = await this.post<ApiResponse<any>>(
      '/api/v1/ai/generate-application',
      { description }
    );
    if (!response.success || !response.data) {
      throw new ApiError(response.error || 'Generation failed', 400);
    }
    return response.data;
  }

  // ============================================================
  // WORKFLOW API
  // ============================================================

  static async listWorkflows(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Workflow[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const response = await this.get<any>(
      `/api/v1/workflows?${query.toString()}`
    );
    return { data: response.data || [], pagination: response.pagination };
  }

  static async getWorkflow(id: string): Promise<Workflow> {
    const response = await this.get<ApiResponse<Workflow>>(
      `/api/v1/workflows/${id}`
    );
    if (!response.success || !response.data) {
      throw new ApiError('Workflow not found', 404);
    }
    return response.data;
  }

  static async createWorkflow(params: {
    name: string;
    description?: string;
    definition: any;
  }): Promise<Workflow> {
    const response = await this.post<ApiResponse<Workflow>>(
      '/api/v1/workflows',
      params
    );
    if (!response.success || !response.data) {
      throw new ApiError(response.error || 'Create failed', 400);
    }
    return response.data;
  }

  static async deleteWorkflow(id: string): Promise<void> {
    const response = await this.delete<ApiResponse<any>>(
      `/api/v1/workflows/${id}`
    );
    if (!response.success) {
      throw new ApiError(response.error || 'Delete failed', 400);
    }
  }

  static async executeWorkflow(id: string, input?: any): Promise<any> {
    const response = await this.post<ApiResponse<any>>(
      `/api/v1/workflows/${id}/execute`,
      { input }
    );
    return response;
  }

  static async listWorkflowExecutions(id: string): Promise<any> {
    const response = await this.get<any>(`/api/v1/workflows/${id}/executions`);
    return response;
  }
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export const api = ApiClient;

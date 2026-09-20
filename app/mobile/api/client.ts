/**
 * VYENFITA Mobile API Client
 * 
 * Same API as web, but uses expo-secure-store for tokens.
 * 
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import config from '../config';

// ============================================================
// TYPES
// ============================================================

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

export interface AuthResult {
  user: User;
  tenant: Tenant;
  role: { id: string; name: string; permissions: string[] };
  tokens: AuthTokens;
}

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
// TOKEN STORAGE
// ============================================================

class TokenStorage {
  static async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(config.storageKeys.accessToken);
    } catch {
      return null;
    }
  }

  static async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(config.storageKeys.refreshToken);
    } catch {
      return null;
    }
  }

  static async getTenantId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(config.storageKeys.tenantId);
    } catch {
      return null;
    }
  }

  static async setTokens(tokens: AuthTokens, tenantId: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(config.storageKeys.accessToken, tokens.accessToken),
      SecureStore.setItemAsync(config.storageKeys.refreshToken, tokens.refreshToken),
      SecureStore.setItemAsync(config.storageKeys.tenantId, tenantId),
    ]);
  }

  static async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(config.storageKeys.accessToken),
      SecureStore.deleteItemAsync(config.storageKeys.refreshToken),
      SecureStore.deleteItemAsync(config.storageKeys.tenantId),
    ]);
  }
}

// ============================================================
// AXIOS INSTANCE
// ============================================================

class ApiClient {
  private instance: AxiosInstance;
  private isRefreshing = false;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Request interceptor: add auth token
    this.instance.interceptors.request.use(async (req) => {
      const token = await TokenStorage.getAccessToken();
      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
      }
      const tenantId = await TokenStorage.getTenantId();
      if (tenantId) {
        req.headers['X-Tenant-Id'] = tenantId;
      }
      return req;
    });

    // Response interceptor: handle 401 with refresh
    this.instance.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const tokens = await this.refreshTokens();
            const tenantId = (await TokenStorage.getTenantId()) || '';
            await TokenStorage.setTokens(tokens, tenantId);
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return this.instance(originalRequest);
          } catch (refreshError) {
            await TokenStorage.clearTokens();
            throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
          }
        }

        throw this.handleError(error);
      }
    );
  }

  private async refreshTokens(): Promise<AuthTokens> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await TokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(
          `${config.apiUrl}/api/v1/auth/refresh`,
          { refreshToken }
        );

        this.refreshPromise = null;
        return response.data.data;
      } catch (error) {
        this.refreshPromise = null;
        throw error;
      }
    })();

    return this.refreshPromise;
  }

  private handleError(error: any): ApiError {
    if (error.response) {
      return new ApiError(
        error.response.data?.error || `HTTP ${error.response.status}`,
        error.response.status,
        error.response.data?.code,
        error.response.data?.details
      );
    }
    if (error.request) {
      return new ApiError('Network error', 0, 'NETWORK_ERROR');
    }
    return new ApiError(error.message || 'Unknown error', 0, 'UNKNOWN');
  }

  // ============================================================
  // HTTP METHODS
  // ============================================================

  async get<T = any>(url: string, options?: AxiosRequestConfig): Promise<T> {
    const res = await this.instance.get(url, options);
    return res.data;
  }

  async post<T = any>(url: string, data?: any, options?: AxiosRequestConfig): Promise<T> {
    const res = await this.instance.post(url, data, options);
    return res.data;
  }

  async put<T = any>(url: string, data?: any, options?: AxiosRequestConfig): Promise<T> {
    const res = await this.instance.put(url, data, options);
    return res.data;
  }

  async patch<T = any>(url: string, data?: any, options?: AxiosRequestConfig): Promise<T> {
    const res = await this.instance.patch(url, data, options);
    return res.data;
  }

  async delete<T = any>(url: string, options?: AxiosRequestConfig): Promise<T> {
    const res = await this.instance.delete(url, options);
    return res.data;
  }

  // ============================================================
  // AUTH
  // ============================================================

  async register(params: {
    email: string;
    password: string;
    name: string;
    tenantName?: string;
  }): Promise<AuthResult> {
    const res = await this.post<ApiResponse<AuthResult>>('/api/v1/auth/register', params);
    if (!res.success || !res.data) {
      throw new ApiError(res.error || 'Registration failed', 400);
    }
    await TokenStorage.setTokens(res.data.tokens, res.data.tenant.id);
    return res.data;
  }

  async login(params: {
    email: string;
    password: string;
    tenantId: string;
  }): Promise<AuthResult> {
    const res = await this.post<ApiResponse<AuthResult>>('/api/v1/auth/login', params);
    if (!res.success || !res.data) {
      throw new ApiError(res.error || 'Login failed', 401);
    }
    await TokenStorage.setTokens(res.data.tokens, res.data.tenant.id);
    return res.data;
  }

  async logout(): Promise<void> {
    try {
      await this.post('/api/v1/auth/logout');
    } catch {
      // ignore
    }
    await TokenStorage.clearTokens();
  }

  async me(): Promise<any> {
    const res = await this.get<ApiResponse<any>>('/api/v1/auth/me');
    return res.data;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await TokenStorage.getAccessToken();
    return !!token;
  }

  // ============================================================
  // TENANT
  // ============================================================

  async getTenant(): Promise<Tenant> {
    const res = await this.get<ApiResponse<Tenant>>('/api/v1/tenant');
    if (!res.success || !res.data) throw new ApiError('Failed to get tenant', 500);
    return res.data;
  }

  async getTenantStats(): Promise<any> {
    const res = await this.get<ApiResponse<any>>('/api/v1/tenant/stats');
    return res.data || {};
  }

  // ============================================================
  // APPLICATIONS
  // ============================================================

  async listApplications(params?: { page?: number; limit?: number }): Promise<any> {
    const res = await this.get<any>('/api/v1/applications', { params });
    return res;
  }

  async getApplication(id: string): Promise<any> {
    const res = await this.get<ApiResponse<any>>(`/api/v1/applications/${id}`);
    return res.data;
  }

  // ============================================================
  // WORKFLOWS
  // ============================================================

  async listWorkflows(params?: { page?: number; limit?: number }): Promise<any> {
    const res = await this.get<any>('/api/v1/workflows', { params });
    return res;
  }

  async executeWorkflow(id: string, input?: any): Promise<any> {
    const res = await this.post<any>(`/api/v1/workflows/${id}/execute`, { input });
    return res;
  }

  async listExecutions(workflowId: string): Promise<any> {
    const res = await this.get<any>(`/api/v1/workflows/${workflowId}/executions`);
    return res;
  }

  // ============================================================
  // APPROVALS
  // ============================================================

  async listPendingApprovals(): Promise<any[]> {
    const res = await this.get<ApiResponse<any[]>>('/api/v1/approvals/pending');
    return res.data || [];
  }

  async approveApproval(approvalId: string, response?: string): Promise<any> {
    const res = await this.post<any>(`/api/v1/approvals/${approvalId}/approve`, { response });
    return res;
  }

  async rejectApproval(approvalId: string, response?: string): Promise<any> {
    const res = await this.post<any>(`/api/v1/approvals/${approvalId}/reject`, { response });
    return res;
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
    try {
      await this.post('/api/v1/notifications/register', { token, platform });
    } catch {
      // Non-fatal
    }
  }
}

export const api = new ApiClient();
export { TokenStorage };
export default api;

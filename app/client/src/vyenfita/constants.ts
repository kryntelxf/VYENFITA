/**
 * VYENFITA Client Constants
 * 
 * @version 1.0.0
 */

/**
 * Base path for all VYENFITA routes
 * Used by AppRouter to detect VYENFITA context
 */
export const VYENFITA_BASE_PATH = '/vyenfita';

/**
 * Get VYENFITA API base URL from various sources
 */
export function getVYENFITAApiUrl(): string {
  // Runtime injection (production)
  if (typeof window !== 'undefined' && (window as any).VYENFITA_API_URL) {
    return (window as any).VYENFITA_API_URL;
  }

  // Build-time env var
  if (process.env.REACT_APP_VYENFITA_API_URL) {
    return process.env.REACT_APP_VYENFITA_API_URL;
  }

  // Development fallback
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }

  return 'http://localhost:3001';
}

export const VYENFITA_ROUTES = {
  LOGIN: '/vyenfita/login',
  REGISTER: '/vyenfita/register',
  DASHBOARD: '/vyenfita/dashboard',
  APPLICATIONS: '/vyenfita/applications',
  NEW_APPLICATION: '/vyenfita/applications/new',
  WORKFLOWS: '/vyenfita/workflows',
  SETTINGS: '/vyenfita/settings',
  TEAM: '/vyenfita/settings/team',
} as const;

export const VYENFITA_STORAGE_KEYS = {
  ACCESS_TOKEN: 'vyenfita.accessToken',
  REFRESH_TOKEN: 'vyenfita.refreshToken',
  TENANT_ID: 'vyenfita.tenantId',
} as const;

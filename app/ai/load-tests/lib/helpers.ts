/**
 * VYENFITA k6 Helpers
 * 
 * @version 1.0.0
 */

import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export function generateEmail(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 10);
  return `loadtest-${ts}-${rand}@example.com`;
}

export function generatePassword(): string {
  return 'TestPass123!';
}

export function jsonHeaders(): { [key: string]: string } {
  return { 'Content-Type': 'application/json' };
}

export function authHeaders(
  token: string,
  tenantId: string
): { [key: string]: string } {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
  };
}

export function checkOk(res: any, name: string): boolean {
  return check(res, {
    [`${name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
}

export function healthCheck(): void {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health status is 200': (r) => r.status === 200,
    'health response < 500ms': (r) => r.timings.duration < 500,
  });
}

export function login(email: string, password: string, tenantId: string): any {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password, tenantId }),
    { headers: jsonHeaders() }
  );

  check(res, {
    'login status is 200': (r) => r.status === 200,
  });

  return res.json();
}

export function registerNewUser(): {
  email: string;
  password: string;
  tenantId: string;
  token: string;
} | null {
  const email = generateEmail();
  const password = generatePassword();

  const res = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({
      email,
      password,
      name: 'Load Test User',
      tenantName: `Load Test ${Date.now()}`,
    }),
    { headers: jsonHeaders() }
  );

  if (res.status !== 201 && res.status !== 200) {
    console.error(`Register failed: ${res.status} ${res.body}`);
    return null;
  }

  const body = res.json() as any;
  if (!body?.data?.tokens?.accessToken || !body?.data?.tenant?.id) {
    return null;
  }

  return {
    email,
    password,
    tenantId: body.data.tenant.id,
    token: body.data.tokens.accessToken,
  };
}

/**
 * VYENFITA k6 Smoke Test
 * 
 * 1 virtual user, 1 minute.
 * 
 * @version 1.0.0
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { SMOKE_OPTIONS, BASE_URL } from '../k6.config';
import { registerNewUser, authHeaders, checkOk } from '../lib/helpers';

export const options = SMOKE_OPTIONS;

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health is 200': (r) => r.status === 200,
    'health latency < 200ms': (r) => r.timings.duration < 200,
  });

  const user = registerNewUser();
  if (!user) {
    console.error('Failed to register user');
    return;
  }

  const listRes = http.get(
    `${BASE_URL}/api/v1/applications`,
    { headers: authHeaders(user.token, user.tenantId) }
  );
  checkOk(listRes, 'list applications');

  const createRes = http.post(
    `${BASE_URL}/api/v1/applications`,
    JSON.stringify({
      name: `Load Test App ${Date.now()}`,
      description: 'Created by k6 smoke test',
      spec: { metadata: {}, entities: [], pages: [], roles: [] },
    }),
    { headers: authHeaders(user.token, user.tenantId) }
  );
  checkOk(createRes, 'create application');

  sleep(1);
}

/**
 * VYENFITA k6 Load Test
 * 
 * Ramp up to 50 VUs over 5 minutes.
 * 
 * @version 1.0.0
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { LOAD_OPTIONS, BASE_URL } from '../k6.config';
import { registerNewUser, authHeaders, checkOk } from '../lib/helpers';

export const options = LOAD_OPTIONS;

let user = null;

export default function () {
  if (!user) {
    user = registerNewUser();
    if (!user) {
      sleep(2);
      return;
    }
  }

  const op = Math.random();

  if (op < 0.4) {
    const res = http.get(
      `${BASE_URL}/api/v1/applications`,
      { headers: authHeaders(user.token, user.tenantId) }
    );
    checkOk(res, 'list applications');
  } else if (op < 0.7) {
    const res = http.get(
      `${BASE_URL}/api/v1/workflows`,
      { headers: authHeaders(user.token, user.tenantId) }
    );
    checkOk(res, 'list workflows');
  } else {
    const res = http.post(
      `${BASE_URL}/api/v1/applications`,
      JSON.stringify({
        name: `Load App ${Date.now()}`,
        description: 'Load test',
        spec: { metadata: {}, entities: [], pages: [], roles: [] },
      }),
      { headers: authHeaders(user.token, user.tenantId) }
    );
    checkOk(res, 'create application');
  }

  sleep(Math.random() * 2 + 1);
}

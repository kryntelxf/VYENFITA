/**
 * VYENFITA k6 Stress Test
 * 
 * Ramp up to 200 VUs. Find breaking point.
 * 
 * @version 1.0.0
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { STRESS_OPTIONS, BASE_URL } from '../k6.config';
import { registerNewUser, authHeaders, checkOk } from '../lib/helpers';

export const options = STRESS_OPTIONS;

let user = null;

export default function () {
  if (!user) {
    user = registerNewUser();
    if (!user) {
      sleep(2);
      return;
    }
  }

  const res = http.get(
    `${BASE_URL}/api/v1/applications`,
    { headers: authHeaders(user.token, user.tenantId) }
  );
  checkOk(res, 'list applications');

  sleep(0.5);
}

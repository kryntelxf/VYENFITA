/**
 * VYENFITA k6 Spike Test
 * 
 * Sudden burst to 500 VUs.
 * 
 * @version 1.0.0
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { SPIKE_OPTIONS, BASE_URL } from '../k6.config';

export const options = SPIKE_OPTIONS;

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health responded': (r) => r.status === 200 || r.status === 429,
  });
  sleep(0.2);
}

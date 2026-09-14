/**
 * VYENFITA Cron Parser Unit Tests
 * 
 * @version 1.0.0
 */

import { CronParser } from '../../lib/workflow/cron-parser';

describe('CronParser', () => {
  describe('parse', () => {
    it('should parse a simple cron', () => {
      const fields = CronParser.parse('0 9 * * 1');
      expect(fields.minutes).toEqual([0]);
      expect(fields.hours).toEqual([9]);
      expect(fields.daysOfWeek).toEqual([1]);
    });

    it('should parse wildcard', () => {
      const fields = CronParser.parse('* * * * *');
      expect(fields.minutes.length).toBe(60);
      expect(fields.hours.length).toBe(24);
    });

    it('should parse ranges', () => {
      const fields = CronParser.parse('0 9 * * 1-5');
      expect(fields.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse lists', () => {
      const fields = CronParser.parse('0,15,30,45 * * * *');
      expect(fields.minutes).toEqual([0, 15, 30, 45]);
    });

    it('should parse step values', () => {
      const fields = CronParser.parse('*/15 * * * *');
      expect(fields.minutes).toEqual([0, 15, 30, 45]);
    });

    it('should throw on invalid expression', () => {
      expect(() => CronParser.parse('invalid')).toThrow();
      expect(() => CronParser.parse('0 9 * *')).toThrow();
    });

    it('should throw on out-of-range values', () => {
      expect(() => CronParser.parse('60 9 * * *')).toThrow();
      expect(() => CronParser.parse('0 25 * * *')).toThrow();
    });
  });

  describe('getNextRun', () => {
    it('should find next run for every-minute cron', () => {
      const from = new Date('2026-01-01T10:00:00Z');
      const next = CronParser.getNextRun('* * * * *', from);
      expect(next.getTime()).toBeGreaterThan(from.getTime());
      expect(next.getTime() - from.getTime()).toBeLessThanOrEqual(60 * 1000);
    });

    it('should find next Monday 9 AM for "0 9 * * 1"', () => {
      const from = new Date('2026-01-01T10:00:00Z'); // Thursday
      const next = CronParser.getNextRun('0 9 * * 1', from);

      expect(next.getDay()).toBe(1); // Monday
      expect(next.getHours()).toBe(9);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('validate', () => {
    it('should return valid for correct cron', () => {
      expect(CronParser.validate('0 9 * * 1').valid).toBe(true);
    });

    it('should return invalid with error for bad cron', () => {
      const result = CronParser.validate('bad cron');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

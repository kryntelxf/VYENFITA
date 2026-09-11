/**
 * VYENFITA Cron Parser
 * 
 * Minimal cron parser supporting standard 5-field format:
 *   minute hour day-of-month month day-of-week
 * 
 * Examples:
 *   "0 9 * * 1"     → 9 AM every Monday
 *   "*\/15 * * * *"  → every 15 minutes
 *   "0 0 1 * *"     → midnight on 1st of month
 *   "0 9 * * 1-5"   → 9 AM Monday-Friday
 * 
 * @version 1.0.0
 */

export interface CronFields {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

export class CronParser {
  /**
   * Parse a cron expression into fields
   */
  static parse(expression: string): CronFields {
    const parts = expression.trim().split(/\s+/);

    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: must have 5 fields, got ${parts.length}`);
    }

    return {
      minutes: this.parseField(parts[0], 0, 59),
      hours: this.parseField(parts[1], 0, 23),
      daysOfMonth: this.parseField(parts[2], 1, 31),
      months: this.parseField(parts[3], 1, 12),
      daysOfWeek: this.parseField(parts[4], 0, 6), // 0 = Sunday
    };
  }

  /**
   * Get the next run time from a reference date
   */
  static getNextRun(expression: string, from: Date = new Date(), timezone?: string): Date {
    const fields = this.parse(expression);

    // Try up to 4 years ahead (safety)
    const maxIterations = 366 * 4 * 24 * 60;
    const start = new Date(from.getTime() + 60 * 1000); // at least 1 minute ahead
    const cursor = new Date(start);

    // Zero out seconds and milliseconds
    cursor.setSeconds(0);
    cursor.setMilliseconds(0);

    for (let i = 0; i < maxIterations; i++) {
      if (this.matches(fields, cursor)) {
        return new Date(cursor);
      }
      cursor.setMinutes(cursor.getMinutes() + 1);
    }

    throw new Error('Could not find next run within 4 years');
  }

  /**
   * Check if a date matches the cron fields
   */
  static matches(fields: CronFields, date: Date): boolean {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dom = date.getDate();
    const month = date.getMonth() + 1;
    const dow = date.getDay();

    if (!fields.minutes.includes(minute)) return false;
    if (!fields.hours.includes(hour)) return false;
    if (!fields.months.includes(month)) return false;
    if (!fields.daysOfMonth.includes(dom)) return false;
    if (!fields.daysOfWeek.includes(dow)) return false;

    return true;
  }

  /**
   * Validate a cron expression
   */
  static validate(expression: string): { valid: boolean; error?: string } {
    try {
      this.parse(expression);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid cron',
      };
    }
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static parseField(field: string, min: number, max: number): number[] {
    // Handle lists: "1,2,3"
    if (field.includes(',')) {
      return field
        .split(',')
        .flatMap((part) => this.parseField(part, min, max))
        .filter((v, i, arr) => arr.indexOf(v) === i) // dedupe
        .sort((a, b) => a - b);
    }

    // Handle step values: "*/5" or "1-10/2"
    if (field.includes('/')) {
      const [rangeStr, stepStr] = field.split('/');
      const step = parseInt(stepStr, 10);

      if (isNaN(step) || step <= 0) {
        throw new Error(`Invalid step value: ${stepStr}`);
      }

      let rangeStart = min;
      let rangeEnd = max;

      if (rangeStr !== '*') {
        const [s, e] = rangeStr.split('-');
        rangeStart = parseInt(s, 10);
        rangeEnd = e ? parseInt(e, 10) : max;
      }

      const result: number[] = [];
      for (let i = rangeStart; i <= rangeEnd; i += step) {
        result.push(i);
      }
      return result;
    }

    // Handle ranges: "1-5"
    if (field.includes('-')) {
      const [start, end] = field.split('-').map((v) => parseInt(v, 10));

      if (isNaN(start) || isNaN(end) || start > end) {
        throw new Error(`Invalid range: ${field}`);
      }

      const result: number[] = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    }

    // Wildcard
    if (field === '*') {
      const result: number[] = [];
      for (let i = min; i <= max; i++) {
        result.push(i);
      }
      return result;
    }

    // Single value
    const value = parseInt(field, 10);

    if (isNaN(value) || value < min || value > max) {
      throw new Error(`Invalid value: ${field} (expected ${min}-${max})`);
    }

    return [value];
  }
      }

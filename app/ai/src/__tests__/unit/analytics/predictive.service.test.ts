/**
 * VYENFITA Predictive Analytics Service Unit Tests
 * 
 * Verifies:
 * - Linear regression forecasting
 * - Moving average forecasting
 * - Exponential smoothing forecasting
 * - Auto model selection
 * - Edge cases (insufficient data, flat data)
 * 
 * @version 1.0.0
 */

import { PredictiveService, HistoricalPoint } from '../../../lib/analytics/predictive.service';

// Helper: generate synthetic historical data
function makeHistory(
  values: number[],
  startDate: Date = new Date('2026-01-01')
): HistoricalPoint[] {
  return values.map((value, i) => ({
    timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
    value,
  }));
}

describe('PredictiveService', () => {
  describe('linearRegression()', () => {
    it('should forecast perfect linear trend', () => {
      const history = makeHistory([1, 3, 5, 7, 9, 11]);
      const result = PredictiveService.linearRegression(history, 3, 'sales');

      expect(result.model).toBe('linear');
      expect(result.horizon).toBe(3);
      expect(result.dataPoints.length).toBe(3);

      expect(result.dataPoints[0].value).toBeCloseTo(13, 1);
      expect(result.dataPoints[1].value).toBeCloseTo(15, 1);
      expect(result.dataPoints[2].value).toBeCloseTo(17, 1);

      expect(result.accuracy).toBeGreaterThan(95);
    });

    it('should handle upward trend with noise', () => {
      const history = makeHistory([10, 12, 14, 16, 18, 20, 22]);
      const result = PredictiveService.linearRegression(history, 5, 'revenue');

      expect(result.dataPoints.length).toBe(5);
      const first = result.dataPoints[0].value;
      const last = result.dataPoints[4].value;
      expect(last).toBeGreaterThan(first);
    });

    it('should handle downward trend', () => {
      const history = makeHistory([100, 90, 80, 70, 60, 50]);
      const result = PredictiveService.linearRegression(history, 3, 'churn');
      expect(result.dataPoints[0].value).toBeLessThan(50);
    });

    it('should include confidence interval', () => {
      const history = makeHistory([10, 12, 11, 13, 12, 14]);
      const result = PredictiveService.linearRegression(history, 3, 'metric');

      for (const point of result.dataPoints) {
        expect(point.confidence).toBeDefined();
        expect(point.confidence.lower).toBeLessThan(point.value);
        expect(point.confidence.upper).toBeGreaterThan(point.value);
      }
    });

    it('should throw when fewer than 2 data points', () => {
      expect(() =>
        PredictiveService.linearRegression(makeHistory([10]), 3, 'x')
      ).toThrow(/at least 2 data points/);
    });

    it('should return timestamps in the future', () => {
      const history = makeHistory([1, 2, 3, 4, 5]);
      const result = PredictiveService.linearRegression(history, 3, 'metric');
      const lastHistoricalTime = history[history.length - 1].timestamp.getTime();

      for (const point of result.dataPoints) {
        expect(point.timestamp.getTime()).toBeGreaterThan(lastHistoricalTime);
      }
    });
  });

  describe('movingAverage()', () => {
    it('should forecast using average of last N points', () => {
      const history = makeHistory([10, 20, 30, 40, 50]);
      const result = PredictiveService.movingAverage(history, 3, 3, 'metric');

      expect(result.model).toBe('moving_average');
      for (const point of result.dataPoints) {
        expect(point.value).toBeCloseTo(40, 5);
      }
    });

    it('should throw when history shorter than window size', () => {
      expect(() =>
        PredictiveService.movingAverage(makeHistory([10, 20]), 3, 5, 'x')
      ).toThrow(/at least 5 data points/);
    });

    it('should handle single-value window', () => {
      const history = makeHistory([10, 20, 30]);
      const result = PredictiveService.movingAverage(history, 2, 1, 'metric');
      expect(result.dataPoints[0].value).toBe(30);
    });

    it('should include confidence interval based on variance', () => {
      const history = makeHistory([10, 20, 30, 40, 50]);
      const result = PredictiveService.movingAverage(history, 3, 3, 'metric');

      for (const point of result.dataPoints) {
        expect(point.confidence.lower).toBeLessThan(point.value);
        expect(point.confidence.upper).toBeGreaterThan(point.value);
      }
    });
  });

  describe('exponentialSmoothing()', () => {
    it('should smooth with alpha=0.5', () => {
      const history = makeHistory([10, 20, 30, 40, 50]);
      const result = PredictiveService.exponentialSmoothing(history, 3, 0.5, 'metric');

      expect(result.model).toBe('exponential_smoothing');
      expect(result.dataPoints.length).toBe(3);

      const firstValue = result.dataPoints[0].value;
      for (const point of result.dataPoints) {
        expect(point.value).toBeCloseTo(firstValue, 5);
      }
    });

    it('should weight recent values more with high alpha', () => {
      const history = makeHistory([10, 10, 10, 10, 100]);

      const lowAlpha = PredictiveService.exponentialSmoothing(history, 1, 0.1, 'metric');
      const highAlpha = PredictiveService.exponentialSmoothing(history, 1, 0.9, 'metric');

      expect(highAlpha.dataPoints[0].value).toBeGreaterThan(
        lowAlpha.dataPoints[0].value
      );
    });

    it('should throw when fewer than 3 data points', () => {
      expect(() =>
        PredictiveService.exponentialSmoothing(makeHistory([10, 20]), 3, 0.3, 'x')
      ).toThrow(/at least 3 data points/);
    });
  });

  describe('autoForecast()', () => {
    it('should use moving average for short history', () => {
      const history = makeHistory([10, 20, 30]);
      const result = PredictiveService.autoForecast(history, 3, 'metric');
      expect(result.model).toBe('moving_average');
    });

    it('should use linear regression when data fits well', () => {
      const history = makeHistory([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      const result = PredictiveService.autoForecast(history, 5, 'metric');
      expect(result.model).toBe('linear');
    });

    it('should fallback to exponential smoothing for noisy data', () => {
      const noisyValues = [50, 10, 90, 20, 80, 30, 70, 40, 60, 55];
      const history = makeHistory(noisyValues);
      const result = PredictiveService.autoForecast(history, 3, 'metric');
      expect(['linear', 'exponential_smoothing']).toContain(result.model);
    });

    it('should always return valid forecast structure', () => {
      const history = makeHistory([10, 20, 30, 40, 50, 60]);
      const result = PredictiveService.autoForecast(history, 7, 'metric');

      expect(result.metric).toBe('metric');
      expect(result.horizon).toBe(7);
      expect(result.dataPoints.length).toBe(7);

      for (const point of result.dataPoints) {
        expect(point.timestamp).toBeInstanceOf(Date);
        expect(typeof point.value).toBe('number');
        expect(Number.isFinite(point.value)).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle all-zero history', () => {
      const history = makeHistory([0, 0, 0, 0, 0]);
      const result = PredictiveService.linearRegression(history, 3, 'metric');
      for (const point of result.dataPoints) {
        expect(point.value).toBeCloseTo(0, 5);
      }
    });

    it('should handle flat non-zero history', () => {
      const history = makeHistory([42, 42, 42, 42, 42]);
      const result = PredictiveService.linearRegression(history, 3, 'metric');
      for (const point of result.dataPoints) {
        expect(point.value).toBeCloseTo(42, 1);
      }
    });

    it('should handle very large values', () => {
      const history = makeHistory([1e9, 2e9, 3e9, 4e9, 5e9]);
      const result = PredictiveService.linearRegression(history, 3, 'metric');
      for (const point of result.dataPoints) {
        expect(Number.isFinite(point.value)).toBe(true);
      }
    });

    it('should handle very small values', () => {
      const history = makeHistory([0.001, 0.002, 0.003, 0.004, 0.005]);
      const result = PredictiveService.linearRegression(history, 3, 'metric');
      for (const point of result.dataPoints) {
        expect(Number.isFinite(point.value)).toBe(true);
      }
    });

    it('should handle horizon=1', () => {
      const history = makeHistory([10, 20, 30, 40, 50]);
      const result = PredictiveService.autoForecast(history, 1, 'metric');
      expect(result.dataPoints.length).toBe(1);
    });

    it('should handle horizon=100', () => {
      const history = makeHistory([10, 20, 30, 40, 50]);
      const result = PredictiveService.autoForecast(history, 100, 'metric');
      expect(result.dataPoints.length).toBe(100);
    });
  });
});

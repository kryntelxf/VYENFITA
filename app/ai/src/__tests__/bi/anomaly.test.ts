/**
 * VYENFITA Anomaly Detector Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { AnomalyDetector } from '../../lib/bi/anomaly-detector.service';

describe('Anomaly Detector', () => {
  describe('Z-score method', () => {
    it('should detect outliers', () => {
      const values = [10, 12, 11, 13, 12, 11, 10, 12, 11, 100, 12, 11];
      const result = AnomalyDetector.detect(values, { method: 'zscore' });

      expect(result.hasAnomalies).toBe(true);
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.value === 100)).toBe(true);
    });

    it('should not flag normal data', () => {
      const values = [10, 12, 11, 13, 12, 11, 10, 12, 11, 12, 11, 10];
      const result = AnomalyDetector.detect(values, { method: 'zscore' });

      expect(result.hasAnomalies).toBe(false);
    });

    it('should return statistics', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = AnomalyDetector.detect(values);

      expect(result.statistics.mean).toBeCloseTo(5.5, 1);
      expect(result.statistics.min).toBe(1);
      expect(result.statistics.max).toBe(10);
      expect(result.statistics.count).toBe(10);
    });
  });

  describe('IQR method', () => {
    it('should detect outliers', () => {
      const values = [10, 12, 11, 13, 12, 11, 10, 12, 11, 500, 12, 11];
      const result = AnomalyDetector.detect(values, { method: 'iqr' });

      expect(result.hasAnomalies).toBe(true);
      expect(result.anomalies.some((a) => a.value === 500)).toBe(true);
    });

    it('should compute IQR bounds', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = AnomalyDetector.detect(values, { method: 'iqr' });

      expect(result.statistics.q1).toBeGreaterThan(0);
      expect(result.statistics.q3).toBeGreaterThan(result.statistics.q1);
      expect(result.statistics.iqr).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle insufficient data', () => {
      const result = AnomalyDetector.detect([1, 2, 3]);
      expect(result.hasAnomalies).toBe(false);
    });

    it('should handle empty array', () => {
      const result = AnomalyDetector.detect([]);
      expect(result.hasAnomalies).toBe(false);
      expect(result.statistics.count).toBe(0);
    });

    it('should handle identical values', () => {
      const values = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
      const result = AnomalyDetector.detect(values);
      expect(result.hasAnomalies).toBe(false);
      expect(result.statistics.stdDev).toBe(0);
    });

    it('should ignore NaN values', () => {
      const values = [1, 2, 3, NaN, 5, 6, 7, 8, 9, 10, 11, 12];
      const result = AnomalyDetector.detect(values);
      expect(result.statistics.count).toBe(11);
    });
  });
});

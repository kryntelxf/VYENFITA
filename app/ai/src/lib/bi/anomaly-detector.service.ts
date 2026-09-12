/**
 * VYENFITA Anomaly Detector
 * 
 * Detects anomalies in numeric data using:
 * - Z-score (statistical)
 * - IQR (Interquartile Range)
 * - Moving average deviation
 * 
 * No AI involved — pure statistics for explainability.
 * 
 * @version 1.0.0
 */

export interface AnomalyPoint {
  index: number;
  value: number;
  score: number; // higher = more anomalous
  method: 'zscore' | 'iqr' | 'moving_average';
  reason: string;
}

export interface AnomalyResult {
  hasAnomalies: boolean;
  anomalies: AnomalyPoint[];
  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
    count: number;
  };
  threshold: number;
  method: 'zscore' | 'iqr';
}

export interface DetectOptions {
  threshold?: number; // z-score threshold (default 3)
  method?: 'zscore' | 'iqr';
  minDataPoints?: number; // minimum points to analyze (default 10)
}

export class AnomalyDetector {
  /**
   * Detect anomalies in a numeric array
   */
  static detect(
    values: number[],
    options: DetectOptions = {}
  ): AnomalyResult {
    const threshold = options.threshold ?? 3;
    const method = options.method ?? 'zscore';
    const minDataPoints = options.minDataPoints ?? 10;

    // Filter valid numbers
    const validValues = values.filter(
      (v) => typeof v === 'number' && !isNaN(v) && isFinite(v)
    );

    if (validValues.length < minDataPoints) {
      return {
        hasAnomalies: false,
        anomalies: [],
        statistics: this.computeStatistics(validValues),
        threshold,
        method,
      };
    }

    // Compute statistics
    const stats = this.computeStatistics(validValues);

    // Detect anomalies based on method
    let anomalies: AnomalyPoint[] = [];

    if (method === 'zscore') {
      anomalies = this.detectZScore(values, stats, threshold);
    } else {
      anomalies = this.detectIQR(values, stats);
    }

    return {
      hasAnomalies: anomalies.length > 0,
      anomalies,
      statistics: stats,
      threshold,
      method,
    };
  }

  // ============================================================
  // Z-SCORE METHOD
  // ============================================================

  private static detectZScore(
    values: number[],
    stats: AnomalyResult['statistics'],
    threshold: number
  ): AnomalyPoint[] {
    const anomalies: AnomalyPoint[] = [];

    if (stats.stdDev === 0) return anomalies;

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (typeof value !== 'number' || isNaN(value)) continue;

      const zscore = Math.abs((value - stats.mean) / stats.stdDev);

      if (zscore > threshold) {
        anomalies.push({
          index: i,
          value,
          score: zscore,
          method: 'zscore',
          reason: `Z-score ${zscore.toFixed(2)} exceeds threshold ${threshold} (mean: ${stats.mean.toFixed(2)}, stdDev: ${stats.stdDev.toFixed(2)})`,
        });
      }
    }

    return anomalies;
  }

  // ============================================================
  // IQR METHOD
  // ============================================================

  private static detectIQR(
    values: number[],
    stats: AnomalyResult['statistics']
  ): AnomalyPoint[] {
    const anomalies: AnomalyPoint[] = [];

    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (typeof value !== 'number' || isNaN(value)) continue;

      if (value < lowerBound || value > upperBound) {
        const distance =
          value < lowerBound
            ? (lowerBound - value) / stats.iqr
            : (value - upperBound) / stats.iqr;

        anomalies.push({
          index: i,
          value,
          score: distance,
          method: 'iqr',
          reason: `Value ${value} outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
        });
      }
    }

    return anomalies;
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  private static computeStatistics(values: number[]): AnomalyResult['statistics'] {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        count: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;

    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / count;

    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    const median = this.percentile(sorted, 50);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;

    return {
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      q1,
      q3,
      iqr,
      count,
    };
  }

  private static percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sortedValues[lower];

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
          }

/**
 * VYENFITA Predictive Analytics Service
 * 
 * Time-series forecasting using statistical methods (no external ML needed).
 * 
 * @version 1.0.0
 */

export interface ForecastPoint {
  timestamp: Date;
  value: number;
  confidence: {
    lower: number;
    upper: number;
  };
}

export interface ForecastResult {
  metric: string;
  model: 'linear' | 'moving_average' | 'exponential_smoothing';
  horizon: number;
  dataPoints: ForecastPoint[];
  accuracy?: number; // MAPE for historical fit
}

export interface HistoricalPoint {
  timestamp: Date;
  value: number;
}

export class PredictiveService {
  /**
   * Forecast using linear regression
   */
  static linearRegression(
    history: HistoricalPoint[],
    horizon: number,
    metricName: string
  ): ForecastResult {
    if (history.length < 2) {
      throw new Error('Need at least 2 data points');
    }

    // Convert timestamps to x coordinates
    const baseTime = history[0].timestamp.getTime();
    const xs = history.map((h) => (h.timestamp.getTime() - baseTime) / (24 * 60 * 60 * 1000));
    const ys = history.map((h) => h.value);

    // Compute linear regression: y = a + bx
    const n = xs.length;
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Compute residual standard deviation for confidence intervals
    const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
    const residualStd = Math.sqrt(
      residuals.reduce((s, r) => s + r * r, 0) / n
    );

    // Generate forecast
    const lastX = xs[xs.length - 1];
    const lastTime = history[history.length - 1].timestamp.getTime();

    const dataPoints: ForecastPoint[] = [];
    for (let i = 1; i <= horizon; i++) {
      const futureX = lastX + i;
      const predicted = intercept + slope * futureX;
      const zScore = 1.96; // 95% confidence

      dataPoints.push({
        timestamp: new Date(lastTime + i * 24 * 60 * 60 * 1000),
        value: predicted,
        confidence: {
          lower: predicted - zScore * residualStd,
          upper: predicted + zScore * residualStd,
        },
      });
    }

    // Calculate MAPE (Mean Absolute Percentage Error)
    const mape =
      (residuals.reduce((s, r, i) => {
        return s + Math.abs(r / (ys[i] || 1));
      }, 0) /
        n) *
      100;

    return {
      metric: metricName,
      model: 'linear',
      horizon,
      dataPoints,
      accuracy: 100 - mape,
    };
  }

  /**
   * Forecast using moving average
   */
  static movingAverage(
    history: HistoricalPoint[],
    horizon: number,
    windowSize: number,
    metricName: string
  ): ForecastResult {
    if (history.length < windowSize) {
      throw new Error(`Need at least ${windowSize} data points`);
    }

    const values = history.map((h) => h.value);
    const lastTime = history[history.length - 1].timestamp.getTime();

    // Compute average of last N points
    const recentWindow = values.slice(-windowSize);
    const average = recentWindow.reduce((s, v) => s + v, 0) / windowSize;

    // Compute standard deviation for confidence
    const variance =
      recentWindow.reduce((s, v) => s + Math.pow(v - average, 2), 0) / windowSize;
    const std = Math.sqrt(variance);

    const dataPoints: ForecastPoint[] = [];
    for (let i = 1; i <= horizon; i++) {
      dataPoints.push({
        timestamp: new Date(lastTime + i * 24 * 60 * 60 * 1000),
        value: average,
        confidence: {
          lower: average - 1.96 * std,
          upper: average + 1.96 * std,
        },
      });
    }

    return {
      metric: metricName,
      model: 'moving_average',
      horizon,
      dataPoints,
    };
  }

  /**
   * Forecast using exponential smoothing
   */
  static exponentialSmoothing(
    history: HistoricalPoint[],
    horizon: number,
    alpha: number,
    metricName: string
  ): ForecastResult {
    if (history.length < 3) {
      throw new Error('Need at least 3 data points');
    }

    const values = history.map((h) => h.value);
    const lastTime = history[history.length - 1].timestamp.getTime();

    // Compute exponential smoothing
    let smoothed = values[0];
    const smoothedValues: number[] = [smoothed];

    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
      smoothedValues.push(smoothed);
    }

    // Compute residual std
    const residuals = values.map((v, i) => v - smoothedValues[i]);
    const residualStd = Math.sqrt(
      residuals.reduce((s, r) => s + r * r, 0) / values.length
    );

    const dataPoints: ForecastPoint[] = [];
    for (let i = 1; i <= horizon; i++) {
      dataPoints.push({
        timestamp: new Date(lastTime + i * 24 * 60 * 60 * 1000),
        value: smoothed,
        confidence: {
          lower: smoothed - 1.96 * residualStd,
          upper: smoothed + 1.96 * residualStd,
        },
      });
    }

    return {
      metric: metricName,
      model: 'exponential_smoothing',
      horizon,
      dataPoints,
    };
  }

  /**
   * Auto-select best model based on historical data
   */
  static autoForecast(
    history: HistoricalPoint[],
    horizon: number,
    metricName: string
  ): ForecastResult {
    if (history.length < 5) {
      return this.movingAverage(history, horizon, 3, metricName);
    }

    // Try linear regression
    const linear = this.linearRegression(history, horizon, metricName);
    const linearAccuracy = linear.accuracy || 0;

    // If linear fits well (>80% accuracy), use it
    if (linearAccuracy > 80) {
      return linear;
    }

    // Otherwise use exponential smoothing
    return this.exponentialSmoothing(history, horizon, 0.3, metricName);
  }
}

export default PredictiveService;

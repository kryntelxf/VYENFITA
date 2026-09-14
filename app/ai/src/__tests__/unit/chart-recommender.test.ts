/**
 * VYENFITA Chart Recommender Unit Tests
 * 
 * @version 1.0.0
 */

import { ChartRecommender } from '../../lib/bi/chart-recommender.service';

describe('ChartRecommender', () => {
  it('should recommend metric for single value', () => {
    const result = ChartRecommender.recommend({
      columns: ['total'],
      rows: [{ total: 100 }],
      rowCount: 1,
      executionTimeMs: 10,
      truncated: false,
    });
    expect(result.type).toBe('metric');
  });

  it('should recommend line chart for time series', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      revenue: Math.random() * 1000,
    }));

    const result = ChartRecommender.recommend({
      columns: ['date', 'revenue'],
      rows,
      rowCount: rows.length,
      executionTimeMs: 10,
      truncated: false,
    });

    expect(result.type).toBe('line');
    expect(result.config.xAxis).toBe('date');
  });

  it('should recommend bar chart for categories', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      category: `Cat ${i}`,
      count: Math.random() * 100,
    }));

    const result = ChartRecommender.recommend({
      columns: ['category', 'count'],
      rows,
      rowCount: rows.length,
      executionTimeMs: 10,
      truncated: false,
    });

    expect(result.type).toBe('bar');
  });

  it('should recommend pie chart for few categories', () => {
    const rows = [
      { status: 'active', count: 50 },
      { status: 'pending', count: 30 },
      { status: 'archived', count: 20 },
    ];

    const result = ChartRecommender.recommend({
      columns: ['status', 'count'],
      rows,
      rowCount: rows.length,
      executionTimeMs: 10,
      truncated: false,
    });

    expect(result.type).toBe('pie');
  });

  it('should recommend scatter for two numeric columns', () => {
    const rows = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));

    const result = ChartRecommender.recommend({
      columns: ['x', 'y'],
      rows,
      rowCount: rows.length,
      executionTimeMs: 10,
      truncated: false,
    });

    expect(result.type).toBe('scatter');
  });

  it('should fallback to table', () => {
    const rows = [{ name: 'a', description: 'text' }];
    const result = ChartRecommender.recommend({
      columns: ['name', 'description'],
      rows,
      rowCount: 1,
      executionTimeMs: 10,
      truncated: false,
    });

    expect(['table', 'metric']).toContain(result.type);
  });
});

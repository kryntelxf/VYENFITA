/**
 * VYENFITA Metrics Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { MetricsService } from '../../lib/observability/metrics.service';

describe('Metrics Service', () => {
  let metrics: MetricsService;

  beforeEach(() => {
    metrics = new MetricsService();
  });

  it('should register and increment counter', () => {
    metrics.registerCounter('test_counter', 'Test counter');
    metrics.incrementCounter('test_counter', { label: 'a' }, 1);
    metrics.incrementCounter('test_counter', { label: 'a' }, 2);

    const output = metrics.expose();
    expect(output).toContain('test_counter{label="a"} 3');
  });

  it('should track separate labels', () => {
    metrics.registerCounter('test_counter', 'Test');
    metrics.incrementCounter('test_counter', { label: 'a' });
    metrics.incrementCounter('test_counter', { label: 'b' });
    metrics.incrementCounter('test_counter', { label: 'b' });

    const output = metrics.expose();
    expect(output).toContain('test_counter{label="a"} 1');
    expect(output).toContain('test_counter{label="b"} 2');
  });

  it('should set gauge', () => {
    metrics.registerGauge('test_gauge', 'Test gauge');
    metrics.setGauge('test_gauge', 42);

    const output = metrics.expose();
    expect(output).toContain('test_gauge 42');
  });

  it('should observe histogram', () => {
    metrics.registerHistogram('test_histogram', 'Test', [10, 50, 100]);
    metrics.observeHistogram('test_histogram', 5);
    metrics.observeHistogram('test_histogram', 25);
    metrics.observeHistogram('test_histogram', 75);

    const output = metrics.expose();
    expect(output).toContain('test_histogram_count 3');
    expect(output).toContain('test_histogram_sum 105');
  });

  it('should auto-register unknown metrics', () => {
    metrics.incrementCounter('auto_counter', { x: '1' });
    const output = metrics.expose();
    expect(output).toContain('auto_counter{x="1"} 1');
  });

  it('should escape labels', () => {
    metrics.registerCounter('test_escape', 'Test');
    metrics.incrementCounter('test_escape', { path: '/a"b\\c' });

    const output = metrics.expose();
    expect(output).toContain('\\"');
    expect(output).toContain('\\\\');
  });
});

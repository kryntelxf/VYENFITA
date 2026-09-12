/**
 * VYENFITA Driver Registry Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { DriverRegistry } from '../../lib/deployment/driver-registry';

describe('Driver Registry', () => {
  it('should always have docker driver', () => {
    const registry = new DriverRegistry();
    expect(registry.has('docker')).toBe(true);
  });

  it('should list available drivers', () => {
    const registry = new DriverRegistry();
    const drivers = registry.list();
    expect(drivers).toContain('docker');
  });

  it('should return undefined for unknown driver', () => {
    const registry = new DriverRegistry();
    expect(registry.get('unknown-driver')).toBeUndefined();
  });

  it('should return driver for registered type', () => {
    const registry = new DriverRegistry();
    const driver = registry.get('docker');
    expect(driver).toBeDefined();
    expect(driver?.type).toBe('docker');
  });

  it('should allow custom driver registration', () => {
    const registry = new DriverRegistry();
    const fakeDriver: any = {
      type: 'fake',
      deploy: async () => ({ success: true, deploymentId: '', durationMs: 0, logs: [] }),
      remove: async () => {},
      healthCheck: async () => ({
        healthy: true,
        status: 'healthy',
        checks: [],
        timestamp: new Date(),
      }),
      validate: () => ({ valid: true, errors: [] }),
    };

    registry.register('fake', fakeDriver);
    expect(registry.has('fake')).toBe(true);
    expect(registry.get('fake')).toBe(fakeDriver);
  });
});

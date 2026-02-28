import { SEARCH_HISTORY_KEY, MAX_HISTORY, WIDGET_SIZE_CLASSES, HEALTH_STATUS_CONFIG } from './dashboard';

describe('dashboard constants', () => {
  it('exports SEARCH_HISTORY_KEY as a string', () => {
    expect(typeof SEARCH_HISTORY_KEY).toBe('string');
    expect(SEARCH_HISTORY_KEY.length).toBeGreaterThan(0);
  });

  it('exports MAX_HISTORY as a positive number', () => {
    expect(MAX_HISTORY).toBe(5);
  });

  it('WIDGET_SIZE_CLASSES covers all sizes', () => {
    expect(WIDGET_SIZE_CLASSES).toHaveProperty('sm');
    expect(WIDGET_SIZE_CLASSES).toHaveProperty('md');
    expect(WIDGET_SIZE_CLASSES).toHaveProperty('lg');
    expect(WIDGET_SIZE_CLASSES).toHaveProperty('full');
    Object.values(WIDGET_SIZE_CLASSES).forEach((cls) => {
      expect(typeof cls).toBe('string');
      expect(cls).toContain('col-span');
    });
  });

  it('HEALTH_STATUS_CONFIG covers all statuses', () => {
    expect(HEALTH_STATUS_CONFIG).toHaveProperty('healthy');
    expect(HEALTH_STATUS_CONFIG).toHaveProperty('warning');
    expect(HEALTH_STATUS_CONFIG).toHaveProperty('error');
    expect(HEALTH_STATUS_CONFIG).toHaveProperty('unknown');
    Object.values(HEALTH_STATUS_CONFIG).forEach((cfg) => {
      expect(cfg).toHaveProperty('icon');
      expect(cfg).toHaveProperty('color');
      expect(typeof cfg.color).toBe('string');
    });
  });
});

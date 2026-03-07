import { syncAppearanceConfigValue } from './appearance-sync';

describe('syncAppearanceConfigValue', () => {
  it('normalizes write values before persisting', async () => {
    const updateConfigValue = jest.fn().mockResolvedValue(undefined);
    const fetchConfig = jest.fn().mockResolvedValue({
      'appearance.interface_radius': '0.75',
    });

    const canonical = await syncAppearanceConfigValue({
      key: 'appearance.interface_radius',
      value: '0.74',
      updateConfigValue,
      fetchConfig,
    });

    expect(updateConfigValue).toHaveBeenCalledWith('appearance.interface_radius', '0.75');
    expect(canonical).toBe('0.75');
  });

  it('writes canonical readback when backend returns non-canonical value', async () => {
    const updateConfigValue = jest.fn().mockResolvedValue(undefined);
    const fetchConfig = jest.fn().mockResolvedValue({
      'appearance.interface_radius': '0.74',
    });

    const canonical = await syncAppearanceConfigValue({
      key: 'appearance.interface_radius',
      value: '0.74',
      updateConfigValue,
      fetchConfig,
    });

    expect(updateConfigValue).toHaveBeenNthCalledWith(1, 'appearance.interface_radius', '0.75');
    expect(updateConfigValue).toHaveBeenNthCalledWith(2, 'appearance.interface_radius', '0.75');
    expect(canonical).toBe('0.75');
  });
});

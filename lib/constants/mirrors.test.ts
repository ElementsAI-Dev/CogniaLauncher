import { MIRROR_PRESETS, type MirrorPresetKey } from './mirrors';

describe('MIRROR_PRESETS', () => {
  const presetKeys: MirrorPresetKey[] = ['default', 'china', 'aliyun', 'ustc'];

  it('has exactly 4 presets', () => {
    expect(Object.keys(MIRROR_PRESETS)).toHaveLength(4);
  });

  it.each(presetKeys)('preset "%s" exists', (key) => {
    expect(MIRROR_PRESETS[key]).toBeDefined();
  });

  it.each(presetKeys)('preset "%s" has labelKey and all 4 registry URLs', (key) => {
    const preset = MIRROR_PRESETS[key];
    expect(preset.labelKey).toBeTruthy();
    expect(preset.npm).toMatch(/^https?:\/\//);
    expect(preset.pypi).toMatch(/^https?:\/\//);
    expect(preset.crates).toMatch(/^https?:\/\//);
    expect(preset.go).toMatch(/^https?:\/\//);
  });

  it('default preset uses official registry URLs', () => {
    expect(MIRROR_PRESETS.default.npm).toContain('npmjs.org');
    expect(MIRROR_PRESETS.default.pypi).toContain('pypi.org');
    expect(MIRROR_PRESETS.default.crates).toContain('crates.io');
    expect(MIRROR_PRESETS.default.go).toContain('proxy.golang.org');
  });
});

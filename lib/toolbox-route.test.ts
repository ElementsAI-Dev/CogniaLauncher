import {
  decodeToolIdFromPath,
  encodeToolIdForPath,
  getBuiltInIdFromToolId,
  getLegacyToolboxDetailPath,
  getToolboxDetailPath,
  isBuiltInToolId,
  isPluginToolId,
  shouldUseLegacyToolboxDetailRoute,
  toBuiltInUnifiedToolId,
} from './toolbox-route';

describe('toolbox-route', () => {
  it('encodes and decodes tool id roundtrip', () => {
    const raw = 'plugin:demo/tool?id=1 2';
    const encoded = encodeToolIdForPath(raw);
    expect(encoded).toContain('%');
    expect(decodeToolIdFromPath(encoded)).toBe(raw);
  });

  it('returns empty string when decode input is empty', () => {
    expect(decodeToolIdFromPath('')).toBe('');
  });

  it('falls back to raw value when decodeURIComponent throws', () => {
    expect(decodeToolIdFromPath('%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('builds canonical and legacy toolbox detail paths', () => {
    const builtInToolId = 'builtin:json formatter';
    const pluginToolId = 'plugin:demo:inspect';
    const plainToolId = 'json-formatter';

    expect(getToolboxDetailPath(builtInToolId)).toBe('/toolbox/tool?id=builtin%3Ajson%20formatter');
    expect(getLegacyToolboxDetailPath(builtInToolId)).toBe('/toolbox/tool?id=builtin%3Ajson%20formatter');
    expect(getToolboxDetailPath(pluginToolId)).toBe('/toolbox/tool?id=plugin%3Ademo%3Ainspect');
    expect(getToolboxDetailPath(plainToolId)).toBe('/toolbox/json-formatter');
  });

  it('recognizes plugin and built-in ids and normalizes built-in tool ids', () => {
    expect(isPluginToolId('plugin:demo:inspect')).toBe(true);
    expect(isPluginToolId('json-formatter')).toBe(false);
    expect(isBuiltInToolId('builtin:json-formatter')).toBe(true);
    expect(isBuiltInToolId('json-formatter')).toBe(false);
    expect(toBuiltInUnifiedToolId('json-formatter')).toBe('builtin:json-formatter');
    expect(toBuiltInUnifiedToolId('builtin:json-formatter')).toBe('builtin:json-formatter');
  });

  it('extracts built-in ids and decides when legacy detail routes are required', () => {
    expect(getBuiltInIdFromToolId('')).toBeNull();
    expect(getBuiltInIdFromToolId('plugin:demo:inspect')).toBeNull();
    expect(getBuiltInIdFromToolId('builtin:json-formatter')).toBe('json-formatter');
    expect(getBuiltInIdFromToolId('json-formatter')).toBe('json-formatter');
    expect(shouldUseLegacyToolboxDetailRoute('plugin:demo:inspect')).toBe(true);
    expect(shouldUseLegacyToolboxDetailRoute('builtin:json-formatter')).toBe(true);
    expect(shouldUseLegacyToolboxDetailRoute('json-formatter')).toBe(false);
  });
});

import {
  decodeToolIdFromPath,
  encodeToolIdForPath,
  getLegacyToolboxDetailPath,
  getToolboxDetailPath,
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

    expect(getToolboxDetailPath(builtInToolId)).toBe('/toolbox/tool?id=builtin%3Ajson%20formatter');
    expect(getLegacyToolboxDetailPath(builtInToolId)).toBe('/toolbox/tool?id=builtin%3Ajson%20formatter');
    expect(getToolboxDetailPath(pluginToolId)).toBe('/toolbox/tool?id=plugin%3Ademo%3Ainspect');
  });
});

import {
  bytesToDataUrl,
  guessMimeType,
  inlinePluginAssets,
  isRelativeAssetPath,
  normalizeAssetPath,
} from './plugin-iframe-view';

describe('plugin-iframe-view asset helpers', () => {
  it('identifies relative asset paths', () => {
    expect(isRelativeAssetPath('./main.js')).toBe(true);
    expect(isRelativeAssetPath('assets/style.css')).toBe(true);

    expect(isRelativeAssetPath('https://example.com/a.js')).toBe(false);
    expect(isRelativeAssetPath('data:text/plain;base64,AA==')).toBe(false);
    expect(isRelativeAssetPath('/absolute/path.js')).toBe(false);
    expect(isRelativeAssetPath('#anchor')).toBe(false);
  });

  it('normalizes asset paths by trimming query/hash and ./ prefix', () => {
    expect(normalizeAssetPath('./assets/app.js?v=1#top')).toBe('assets/app.js');
    expect(normalizeAssetPath('  style.css?cache=1  ')).toBe('style.css');
  });

  it('maps mime types and builds data urls', () => {
    expect(guessMimeType('main.js')).toBe('text/javascript');
    expect(guessMimeType('icon.unknown')).toBe('application/octet-stream');

    const url = bytesToDataUrl([65, 66, 67], 'text/plain');
    expect(url).toBe('data:text/plain;base64,QUJD');
  });

  it('inlines relative assets and keeps external assets unchanged', async () => {
    const getUiAsset = jest.fn(
      async (_pluginId: string, assetPath: string): Promise<number[] | null> => {
        if (assetPath === 'main.js') return [99, 111, 110, 115, 111, 108, 101];
        if (assetPath === 'styles.css') return [98, 111, 100, 121];
        if (assetPath === 'logo.png') return [137, 80, 78, 71];
        return null;
      },
    );

    const html = `
      <!doctype html>
      <html>
        <head>
          <script src="./main.js?v=1"></script>
          <link rel="stylesheet" href="styles.css#x" />
        </head>
        <body>
          <img src="logo.png" />
          <img src="https://cdn.example.com/logo.png" />
        </body>
      </html>
    `;

    const output = await inlinePluginAssets(html, 'plugin.demo', getUiAsset);

    expect(output).toContain('data:text/javascript;base64,');
    expect(output).toContain('data:text/css;base64,');
    expect(output).toContain('data:image/png;base64,');
    expect(output).toContain('https://cdn.example.com/logo.png');
    expect(getUiAsset).toHaveBeenCalledWith('plugin.demo', 'main.js');
    expect(getUiAsset).toHaveBeenCalledWith('plugin.demo', 'styles.css');
    expect(getUiAsset).toHaveBeenCalledWith('plugin.demo', 'logo.png');
  });

  it('caches repeated asset lookups by raw path', async () => {
    const getUiAsset = jest.fn(async () => [65, 66, 67]);
    const html = `
      <html>
        <body>
          <img src="logo.png" />
          <img src="logo.png" />
        </body>
      </html>
    `;

    const output = await inlinePluginAssets(html, 'plugin.demo', getUiAsset);
    expect(output).toContain('data:image/png;base64,QUJD');
    expect(getUiAsset).toHaveBeenCalledTimes(1);
  });
});


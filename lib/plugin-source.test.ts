import { getPluginMarketplaceHref, getPluginSourceLabelKey } from './plugin-source';

describe('plugin-source', () => {
  describe('getPluginSourceLabelKey', () => {
    it('returns the built-in label key', () => {
      expect(getPluginSourceLabelKey({ type: 'builtIn' })).toBe('toolbox.plugin.builtIn');
    });

    it('returns the store label key', () => {
      expect(getPluginSourceLabelKey({ type: 'store', storeId: 'demo' })).toBe(
        'toolbox.marketplace.sourceStore',
      );
    });

    it('returns the remote url label key', () => {
      expect(getPluginSourceLabelKey({ type: 'url', url: 'https://example.com/plugin.wasm' })).toBe(
        'toolbox.marketplace.sourceRemote',
      );
    });

    it('falls back to the local label key', () => {
      expect(getPluginSourceLabelKey({ type: 'local', path: 'C:\\plugins\\demo' })).toBe(
        'toolbox.marketplace.sourceLocal',
      );
    });
  });

  describe('getPluginMarketplaceHref', () => {
    it('returns the encoded marketplace href for store sources', () => {
      expect(getPluginMarketplaceHref({ type: 'store', storeId: 'tool kit/demo' })).toBe(
        '/toolbox/market/tool%20kit%2Fdemo',
      );
    });

    it('returns null for non-store sources', () => {
      expect(getPluginMarketplaceHref({ type: 'builtIn' })).toBeNull();
      expect(getPluginMarketplaceHref({ type: 'local', path: 'C:\\plugins\\demo' })).toBeNull();
      expect(getPluginMarketplaceHref({ type: 'url', url: 'https://example.com/plugin.wasm' })).toBeNull();
    });
  });
});

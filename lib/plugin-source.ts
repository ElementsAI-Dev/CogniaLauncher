import type { PluginSource } from '@/types/plugin';

export function getPluginSourceLabelKey(source: PluginSource): string {
  switch (source.type) {
    case 'builtIn':
      return 'toolbox.plugin.builtIn';
    case 'store':
      return 'toolbox.marketplace.sourceStore';
    case 'url':
      return 'toolbox.marketplace.sourceRemote';
    case 'local':
    default:
      return 'toolbox.marketplace.sourceLocal';
  }
}

export function getPluginMarketplaceHref(source: PluginSource): string | null {
  if (source.type !== 'store') return null;
  return `/toolbox/market/${encodeURIComponent(source.storeId)}`;
}

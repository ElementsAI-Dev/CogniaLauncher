'use client';

export type WslOverviewTab = 'installed' | 'available';
export type WslWorkflowOrigin = 'overview' | 'sidebar' | 'widget' | 'detail' | 'assistance';
export type WslActionScope = 'runtime' | 'distro' | 'batch' | 'backup' | 'network';
export type WslActionRisk = 'safe' | 'high';
export type WslRefreshTarget = 'inventory' | 'runtime' | 'config' | 'backup' | 'network';

export interface WslOverviewContext {
  tab: WslOverviewTab;
  tag: string | null;
  origin: WslWorkflowOrigin;
}

export interface WslActionInventoryItem {
  id: string;
  scope: WslActionScope;
  risk: WslActionRisk;
  refreshTargets: WslRefreshTarget[];
  longRunning?: boolean;
}

export const DEFAULT_WSL_OVERVIEW_CONTEXT: WslOverviewContext = {
  tab: 'installed',
  tag: null,
  origin: 'overview',
};

export const WSL_ACTION_INVENTORY: Record<string, WslActionInventoryItem> = {
  'runtime.installOnline': { id: 'runtime.installOnline', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.installWithLocation': { id: 'runtime.installWithLocation', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.installWslOnly': { id: 'runtime.installWslOnly', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.import': { id: 'runtime.import', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.importInPlace': { id: 'runtime.importInPlace', scope: 'runtime', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'runtime.export': { id: 'runtime.export', scope: 'runtime', risk: 'safe', refreshTargets: ['backup'], longRunning: true },
  'runtime.update': { id: 'runtime.update', scope: 'runtime', risk: 'safe', refreshTargets: ['runtime'], longRunning: true },
  'runtime.setDefaultVersion': { id: 'runtime.setDefaultVersion', scope: 'runtime', risk: 'safe', refreshTargets: ['runtime'] },
  'runtime.shutdown': { id: 'runtime.shutdown', scope: 'runtime', risk: 'high', refreshTargets: ['runtime'] },
  'runtime.mount': { id: 'runtime.mount', scope: 'runtime', risk: 'high', refreshTargets: ['runtime'] },
  'runtime.unmount': { id: 'runtime.unmount', scope: 'runtime', risk: 'high', refreshTargets: ['runtime'] },
  'runtime.batchLaunch': { id: 'runtime.batchLaunch', scope: 'batch', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'runtime.batchTerminate': { id: 'runtime.batchTerminate', scope: 'batch', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'runtime.assistance': { id: 'runtime.assistance', scope: 'runtime', risk: 'high', refreshTargets: ['runtime', 'config'] },
  'distro.launch': { id: 'distro.launch', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'distro.terminate': { id: 'distro.terminate', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime'] },
  'distro.setDefault': { id: 'distro.setDefault', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'] },
  'distro.setVersion': { id: 'distro.setVersion', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.changeDefaultUser': { id: 'distro.changeDefaultUser', scope: 'distro', risk: 'safe', refreshTargets: ['inventory'] },
  'distro.unregister': { id: 'distro.unregister', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime', 'config'] },
  'distro.clone': { id: 'distro.clone', scope: 'distro', risk: 'safe', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.move': { id: 'distro.move', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.resize': { id: 'distro.resize', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime'], longRunning: true },
  'distro.sparse': { id: 'distro.sparse', scope: 'distro', risk: 'safe', refreshTargets: ['inventory'] },
  'distro.openInExplorer': { id: 'distro.openInExplorer', scope: 'distro', risk: 'safe', refreshTargets: [] },
  'distro.openInTerminal': { id: 'distro.openInTerminal', scope: 'distro', risk: 'safe', refreshTargets: [] },
  'distro.healthCheck': { id: 'distro.healthCheck', scope: 'distro', risk: 'safe', refreshTargets: ['runtime'] },
  'distro.assistance': { id: 'distro.assistance', scope: 'distro', risk: 'high', refreshTargets: ['inventory', 'runtime', 'config'] },
  'network.addPortForward': { id: 'network.addPortForward', scope: 'network', risk: 'high', refreshTargets: ['network'] },
  'network.removePortForward': { id: 'network.removePortForward', scope: 'network', risk: 'high', refreshTargets: ['network'] },
  'config.runtime': { id: 'config.runtime', scope: 'runtime', risk: 'safe', refreshTargets: ['config', 'runtime'] },
  'config.distro': { id: 'config.distro', scope: 'distro', risk: 'safe', refreshTargets: ['config', 'inventory'] },
  'backup.create': { id: 'backup.create', scope: 'backup', risk: 'safe', refreshTargets: ['backup'], longRunning: true },
  'backup.restore': { id: 'backup.restore', scope: 'backup', risk: 'high', refreshTargets: ['backup', 'inventory', 'runtime', 'config'], longRunning: true },
  'backup.delete': { id: 'backup.delete', scope: 'backup', risk: 'high', refreshTargets: ['backup'] },
};

type SearchParamReader = {
  get: (key: string) => string | null;
};

export function sanitizeWslOverviewContext(
  context?: Partial<WslOverviewContext>
): WslOverviewContext {
  return {
    tab: context?.tab === 'available' ? 'available' : 'installed',
    tag: context?.tag ?? null,
    origin: context?.origin ?? DEFAULT_WSL_OVERVIEW_CONTEXT.origin,
  };
}

export function readWslOverviewContext(
  searchParams?: SearchParamReader | null,
  fallback?: Partial<WslOverviewContext>
): WslOverviewContext {
  const fallbackContext = sanitizeWslOverviewContext(fallback);
  if (!searchParams) return fallbackContext;

  const tabParam = searchParams.get('tab');
  const tagParam = searchParams.get('tag');
  const originParam = searchParams.get('origin') as WslWorkflowOrigin | null;

  return sanitizeWslOverviewContext({
    tab: tabParam === 'available' ? 'available' : fallbackContext.tab,
    tag: tagParam ?? fallbackContext.tag,
    origin: originParam ?? fallbackContext.origin,
  });
}

export function buildWslOverviewHref(
  context?: Partial<WslOverviewContext>
): string {
  const resolved = sanitizeWslOverviewContext(context);
  const params = new URLSearchParams();

  if (resolved.tab !== DEFAULT_WSL_OVERVIEW_CONTEXT.tab) {
    params.set('tab', resolved.tab);
  }
  if (resolved.tag) {
    params.set('tag', resolved.tag);
  }
  if (resolved.origin !== DEFAULT_WSL_OVERVIEW_CONTEXT.origin) {
    params.set('origin', resolved.origin);
  }

  const query = params.toString();
  return query ? `/wsl?${query}` : '/wsl';
}

export function buildWslDistroHref(
  distroName: string,
  options?: Partial<WslOverviewContext> & {
    origin?: WslWorkflowOrigin;
    returnTo?: string;
    continueAction?: string;
  }
): string {
  const params = new URLSearchParams({ name: distroName });
  const resolved = sanitizeWslOverviewContext(options);

  params.set('origin', options?.origin ?? resolved.origin);
  params.set('returnTo', options?.returnTo ?? buildWslOverviewHref(resolved));

  if (options?.continueAction) {
    params.set('continue', options.continueAction);
  }

  return `/wsl/distro?${params.toString()}`;
}

export function normalizeSelectedDistros(
  selected: Iterable<string>,
  distros: Array<{ name: string }>
): Set<string> {
  const validNames = new Set(distros.map((distro) => distro.name));
  return new Set(Array.from(selected).filter((name) => validNames.has(name)));
}

export function summarizeBatchResults(results: [string, boolean, string][]) {
  return {
    total: results.length,
    failed: results.filter(([, ok]) => !ok).length,
    succeeded: results.filter(([, ok]) => ok).length,
    details: results.map(([name, ok, detail]) =>
      `${name}: ${ok ? 'ok' : 'failed'}${detail ? ` — ${detail}` : ''}`
    ),
  };
}

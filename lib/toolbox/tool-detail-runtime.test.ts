import { TOOL_REGISTRY } from '@/lib/constants/toolbox';
import type {
  PluginInfo,
  PluginPermissionMode,
  PluginPermissionState,
  PluginToolInfo,
} from '@/types/plugin';
import type { ToolDefinitionWithMeta } from '@/types/toolbox';
import type { ToolDetailRuntimeTool } from './tool-detail-runtime';
import { resolveToolDetailRuntimeContext } from './tool-detail-runtime';

function createBuiltInTool(overrides?: Partial<ToolDefinitionWithMeta>): ToolDefinitionWithMeta {
  return {
    id: 'json-formatter',
    nameKey: 'toolbox.json.name',
    descriptionKey: 'toolbox.json.description',
    icon: 'Braces',
    category: 'formatters',
    keywords: ['json'],
    component: async () => ({ default: () => null }),
    isNew: false,
    ...overrides,
  };
}

function createPluginTool(overrides?: Partial<PluginToolInfo>): PluginToolInfo {
  return {
    pluginId: 'plugin.demo',
    pluginName: 'Demo Plugin',
    toolId: 'inspect',
    nameEn: 'Inspect',
    nameZh: null,
    descriptionEn: 'Inspect plugin output',
    descriptionZh: null,
    category: 'developer',
    keywords: ['inspect'],
    icon: 'Wrench',
    entry: 'tools/inspect',
    uiMode: 'text',
    ...overrides,
  };
}

function createInstalledPlugin(overrides?: Partial<PluginInfo>): PluginInfo {
  return {
    id: 'plugin.demo',
    name: 'Demo Plugin',
    version: '1.0.0',
    description: 'Demo plugin',
    authors: ['Cognia'],
    toolCount: 1,
    enabled: true,
    installedAt: '2026-03-15T00:00:00.000Z',
    updatedAt: null,
    updateUrl: null,
    source: { type: 'store', storeId: 'demo/store' },
    builtinCandidate: false,
    builtinSyncStatus: null,
    builtinSyncMessage: null,
    ...overrides,
  };
}

function createRuntimeTool(overrides?: Partial<ToolDetailRuntimeTool>): ToolDetailRuntimeTool {
  return {
    id: 'tool.demo',
    name: 'Demo Tool',
    description: 'Demo description',
    icon: 'Wrench',
    category: 'developer',
    keywords: ['demo'],
    isBuiltIn: false,
    isNew: false,
    isBeta: false,
    ...overrides,
  };
}

function resolveContext(overrides?: {
  toolId?: string;
  allTools?: ToolDetailRuntimeTool[];
  pluginTools?: PluginToolInfo[];
  installedPlugins?: PluginInfo[];
  healthMap?: Record<string, never>;
  permissionMode?: PluginPermissionMode;
  permissionStates?: Record<string, PluginPermissionState>;
  isDesktop?: boolean;
}) {
  return resolveToolDetailRuntimeContext({
    toolId: overrides?.toolId ?? '',
    allTools: overrides?.allTools ?? [],
    pluginTools: overrides?.pluginTools ?? [],
    installedPlugins: overrides?.installedPlugins ?? [],
    healthMap: overrides?.healthMap ?? {},
    permissionMode: overrides?.permissionMode ?? 'compat',
    permissionStates: overrides?.permissionStates ?? {},
    isDesktop: overrides?.isDesktop ?? true,
    t: (key) => `t:${key}`,
  });
}

describe('tool-detail-runtime', () => {
  it('returns the unknown recovery state when no tool id is provided', () => {
    expect(resolveContext()).toEqual({
      canonicalToolId: null,
      recoveryState: {
        kind: 'unknown',
        title: 't:toolbox.search.noResults',
        description: 't:toolbox.empty.noResultsDesc',
      },
    });
  });

  it('returns an exact tool match without recovery state on desktop', () => {
    const tool = createRuntimeTool({ id: 'plugin:plugin.demo:inspect', pluginTool: createPluginTool() });

    expect(resolveContext({
      toolId: 'plugin:plugin.demo:inspect',
      allTools: [tool],
      isDesktop: true,
    })).toEqual({
      tool,
      canonicalToolId: 'plugin:plugin.demo:inspect',
      recoveryState: null,
    });
  });

  it('matches built-in tools by builtInDef id and reports unsupported web-mode recovery', () => {
    const builtInDef = createBuiltInTool({ id: 'desktop-only', requiresTauri: true });
    const tool = createRuntimeTool({
      id: 'builtin:desktop-only',
      name: 'Desktop Only',
      isBuiltIn: true,
      builtInDef,
    });

    expect(resolveContext({
      toolId: 'desktop-only',
      allTools: [tool],
      isDesktop: false,
    })).toEqual({
      tool,
      canonicalToolId: 'builtin:desktop-only',
      recoveryState: {
        kind: 'unsupported',
        title: 'Desktop Only',
        description: 't:toolbox.runtime.desktopRequiredDescription',
        manageHref: undefined,
        marketHref: null,
      },
    });
  });

  it('returns unsupported recovery for exact plugin tools in web mode with marketplace links', () => {
    const pluginTool = createPluginTool();
    const tool = createRuntimeTool({
      id: 'plugin:plugin.demo:inspect',
      name: 'Inspect',
      pluginTool,
    });

    expect(resolveContext({
      toolId: 'plugin:plugin.demo:inspect',
      allTools: [tool],
      installedPlugins: [createInstalledPlugin()],
      isDesktop: false,
    })).toEqual({
      tool,
      canonicalToolId: 'plugin:plugin.demo:inspect',
      recoveryState: {
        kind: 'unsupported',
        title: 'Inspect',
        description: 't:toolbox.runtime.desktopRequiredDescription',
        manageHref: '/toolbox/plugins',
        marketHref: '/toolbox/market/demo%2Fstore',
      },
    });
  });

  it('falls back to the built-in registry when the toolbox route resolves a raw built-in id', () => {
    const builtInTool = TOOL_REGISTRY[0];
    expect(builtInTool).toBeDefined();

    const context = resolveContext({
      toolId: builtInTool!.id,
      allTools: [],
      isDesktop: true,
    });

    expect(context.canonicalToolId).toBe(`builtin:${builtInTool!.id}`);
    expect(context.tool).toMatchObject({
      id: `builtin:${builtInTool!.id}`,
      name: `t:${builtInTool!.nameKey}`,
      description: `t:${builtInTool!.descriptionKey}`,
      isBuiltIn: true,
      builtInDef: builtInTool,
    });
    expect(context.recoveryState).toBeNull();
  });

  it('returns blocked recovery with the discoverability reason when a plugin tool is not surfaced in allTools', () => {
    const pluginTool = createPluginTool({
      discoverable: false,
      exclusionReason: 'Permission blocked',
      nameZh: '插件检查',
    });

    expect(resolveContext({
      toolId: 'plugin:plugin.demo:inspect',
      pluginTools: [pluginTool],
      installedPlugins: [createInstalledPlugin()],
      permissionStates: {
        'plugin.demo': {
          declared: {
            uiFeedback: false,
            uiDialog: false,
            uiFilePicker: false,
            uiNavigation: false,
            fsRead: [],
            fsWrite: [],
            http: [],
            configRead: false,
            configWrite: false,
            envRead: false,
            pkgSearch: false,
            pkgInstall: false,
            clipboard: false,
            notification: false,
            processExec: false,
          },
          granted: [],
          denied: [],
        },
      },
    })).toEqual({
      canonicalToolId: 'plugin:plugin.demo:inspect',
      recoveryState: {
        kind: 'blocked',
        title: '插件检查',
        description: 'Permission blocked',
        manageHref: '/toolbox/plugins',
        marketHref: '/toolbox/market/demo%2Fstore',
      },
    });
  });

  it('falls back to the unavailable message when discoverability has no explicit reason', () => {
    const pluginTool = createPluginTool({
      discoverable: true,
      exclusionReason: null,
    });

    expect(resolveContext({
      toolId: 'plugin:plugin.demo:inspect',
      pluginTools: [pluginTool],
      installedPlugins: [createInstalledPlugin()],
      permissionMode: 'compat',
    })).toEqual({
      canonicalToolId: 'plugin:plugin.demo:inspect',
      recoveryState: {
        kind: 'blocked',
        title: 'Inspect',
        description: 't:toolbox.marketplace.unavailable',
        manageHref: '/toolbox/plugins',
        marketHref: '/toolbox/market/demo%2Fstore',
      },
    });
  });

  it('returns the unknown fallback when no exact, built-in, or plugin tool can be resolved', () => {
    expect(resolveContext({
      toolId: 'plugin:missing:tool',
      allTools: [],
      pluginTools: [],
      installedPlugins: [],
    })).toEqual({
      canonicalToolId: null,
      recoveryState: {
        kind: 'unknown',
        title: 't:toolbox.search.noResults',
        description: 't:toolbox.empty.noResultsDesc',
      },
    });
  });
});

import { renderHook } from '@testing-library/react';
import { useToolbox } from './use-toolbox';

const mockIsTauri = jest.fn(() => true);
const mockGetDiscoverabilityDiagnostic = jest.fn();
const mockEvaluatePluginHealthStatus = jest.fn(() => 'healthy');
const mockBuildBuiltInMeta = jest.fn(() => ({ kind: 'builtin' }));
const mockBuildBuiltInCompat = jest.fn(() => ({ ok: true }));
const mockBuildPluginMeta = jest.fn(() => ({ kind: 'plugin' }));
const mockBuildPluginCompat = jest.fn(() => ({ ok: true }));

const toolboxState = {
  selectedCategory: 'all',
  searchQuery: '',
  favorites: ['plugin:p1:t1'],
  recentTools: ['plugin:p1:t1'],
  toolUseCounts: { 'plugin:p1:t1': 5 },
  assistancePanels: {
    history: { collapsed: false, hidden: false },
    featured: { collapsed: true, hidden: false },
  },
  viewMode: 'grid',
  activeToolId: null,
  toolLifecycles: {},
  toggleFavorite: jest.fn(),
  addRecent: jest.fn(),
  setViewMode: jest.fn(),
  setCategory: jest.fn(),
  setSearchQuery: jest.fn(),
  setActiveToolId: jest.fn(),
  setToolLifecycle: jest.fn(),
  clearToolLifecycle: jest.fn(),
  setAssistancePanelCollapsed: jest.fn(),
  hideAssistancePanel: jest.fn(),
  restoreAssistancePanel: jest.fn(),
  restoreAllAssistancePanels: jest.fn(),
};

const pluginState = {
  installedPlugins: [
    { id: 'p1', enabled: true, deprecationWarnings: [] },
    { id: 'p2', enabled: true, deprecationWarnings: [] },
  ],
  pluginTools: [
    {
      pluginId: 'p1',
      toolId: 't1',
      nameEn: 'Proxy Probe',
      nameZh: '代理探测',
      descriptionEn: 'check proxy',
      descriptionZh: '检查代理',
      icon: 'Wrench',
      category: 'network',
      keywords: ['proxy'],
      deprecationWarnings: [],
    },
    {
      pluginId: 'p2',
      toolId: 't2',
      nameEn: 'Hidden Tool',
      nameZh: null,
      descriptionEn: 'hidden',
      descriptionZh: null,
      icon: 'Wrench',
      category: 'network',
      keywords: ['hidden'],
      deprecationWarnings: [],
    },
  ],
  healthMap: {},
  permissionMode: 'compat',
  permissionStates: {},
};

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ locale: 'en', t: (k: string) => k }),
}));

jest.mock('@/lib/stores/toolbox', () => ({
  useToolboxStore: (selector?: (state: typeof toolboxState) => unknown) =>
    selector ? selector(toolboxState) : toolboxState,
}));

jest.mock('@/lib/stores/plugin', () => ({
  usePluginStore: (selector?: (state: typeof pluginState) => unknown) =>
    selector ? selector(pluginState) : pluginState,
}));

jest.mock('@/lib/constants/toolbox', () => ({
  TOOL_REGISTRY: [
    {
      id: 'builtin-shell',
      nameKey: 'builtin.shell',
      descriptionKey: 'builtin.shell.desc',
      icon: 'Terminal',
      category: 'devtools',
      keywords: ['shell'],
      isNew: false,
      requiresTauri: true,
    },
    {
      id: 'builtin-docs',
      nameKey: 'builtin.docs',
      descriptionKey: 'builtin.docs.desc',
      icon: 'Book',
      category: 'docs',
      keywords: ['docs'],
      isNew: false,
      requiresTauri: false,
    },
  ],
  TOOL_CATEGORIES: [{ id: 'devtools' }, { id: 'docs' }],
}));

jest.mock('@/lib/plugin-governance', () => ({
  getDiscoverabilityDiagnostic: (...args: unknown[]) =>
    mockGetDiscoverabilityDiagnostic(...args),
  evaluatePluginHealthStatus: (...args: unknown[]) =>
    mockEvaluatePluginHealthStatus(...args),
}));

jest.mock('@/lib/toolbox/tool-contract-adapters', () => ({
  buildBuiltInToolContractMetadata: (...args: unknown[]) => mockBuildBuiltInMeta(...args),
  buildBuiltInCompatibility: (...args: unknown[]) => mockBuildBuiltInCompat(...args),
  buildPluginToolContractMetadata: (...args: unknown[]) => mockBuildPluginMeta(...args),
  buildPluginCompatibility: (...args: unknown[]) => mockBuildPluginCompat(...args),
}));

describe('useToolbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toolboxState.selectedCategory = 'all';
    toolboxState.searchQuery = '';
    mockIsTauri.mockReturnValue(true);
    mockGetDiscoverabilityDiagnostic.mockImplementation((tool: { pluginId: string }) =>
      tool.pluginId === 'p2'
        ? { discoverable: false, reason: 'policy' }
        : { discoverable: true },
    );
  });

  it('merges built-in and discoverable plugin tools while tracking exclusions', () => {
    const { result } = renderHook(() => useToolbox());

    expect(result.current.allTools.some((t) => t.id === 'plugin:p1:t1')).toBe(true);
    expect(result.current.allTools.some((t) => t.id === 'plugin:p2:t2')).toBe(false);
    expect(result.current.excludedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolId: 'plugin:p2:t2', reason: 'policy' }),
      ]),
    );
  });

  it('applies search/category filters and keeps most-used stats', () => {
    toolboxState.searchQuery = 'proxy';
    toolboxState.selectedCategory = 'all';

    const { result } = renderHook(() => useToolbox());
    expect(result.current.filteredTools).toHaveLength(1);
    expect(result.current.filteredTools[0].id).toBe('plugin:p1:t1');
    expect(result.current.mostUsedCount).toBe(1);
  });

  it('exposes assistance panel state and actions from store', () => {
    const { result } = renderHook(() => useToolbox());

    expect(result.current.assistancePanels.featured.collapsed).toBe(true);
    result.current.setAssistancePanelCollapsed('history', true);
    result.current.hideAssistancePanel('featured');
    result.current.restoreAssistancePanel('featured');
    result.current.restoreAllAssistancePanels();

    expect(toolboxState.setAssistancePanelCollapsed).toHaveBeenCalledWith('history', true);
    expect(toolboxState.hideAssistancePanel).toHaveBeenCalledWith('featured');
    expect(toolboxState.restoreAssistancePanel).toHaveBeenCalledWith('featured');
    expect(toolboxState.restoreAllAssistancePanels).toHaveBeenCalled();
  });
});

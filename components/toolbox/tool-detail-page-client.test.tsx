import { render, screen } from '@testing-library/react';
import { ToolDetailPageClient } from './tool-detail-page-client';

const mockAddRecent = jest.fn();
const mockIsTauri = jest.fn(() => true);
const mockPush = jest.fn();
let mockToolRegistry: Array<Record<string, unknown>> = [];
const mockBuiltInTool = {
  id: 'builtin:json-formatter',
  name: 'JSON Formatter',
  description: 'Format JSON',
  icon: 'Braces',
  category: 'formatters',
  keywords: ['json'],
  isBuiltIn: true,
  isNew: false,
  isBeta: false,
  builtInDef: { id: 'json-formatter' },
};
let mockAllTools = [mockBuiltInTool];
let mockPluginStoreState: {
  installedPlugins: Array<Record<string, unknown>>;
  healthMap: Record<string, unknown>;
  permissionMode: 'compat' | 'strict';
  permissionStates: Record<string, { granted: string[] }>;
} = {
  installedPlugins: [],
  healthMap: {},
  permissionMode: 'compat',
  permissionStates: {},
};

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/constants/toolbox', () => ({
  get TOOL_REGISTRY() {
    return mockToolRegistry;
  },
  getToolById: (toolId: string) => mockToolRegistry.find((tool) => tool.id === toolId),
}));

jest.mock('@/hooks/use-toolbox', () => ({
  useToolbox: () => ({
    allTools: mockAllTools,
  }),
}));

jest.mock('@/lib/stores/toolbox', () => ({
  useToolboxStore: (
    selector: (state: { addRecent: (toolId: string) => void; toolLifecycles: Record<string, unknown> }) => unknown,
  ) =>
    selector({ addRecent: mockAddRecent, toolLifecycles: {} }),
}));

jest.mock('@/lib/stores/plugin', () => ({
  usePluginStore: (
    selector: (state: {
      installedPlugins: unknown[];
      healthMap: Record<string, unknown>;
      permissionMode: 'compat' | 'strict';
      permissionStates: Record<string, { granted: string[] }>;
    }) => unknown,
  ) =>
    selector(mockPluginStoreState),
}));

jest.mock('@/components/toolbox/built-in-tool-renderer', () => ({
  BuiltInToolRenderer: ({ builtInId }: { builtInId: string }) => <div>builtin:{builtInId}</div>,
}));

jest.mock('@/components/toolbox/plugin-tool-runner', () => ({
  PluginToolRunner: () => <div>plugin-tool</div>,
}));

describe('ToolDetailPageClient', () => {
  beforeEach(() => {
    mockAddRecent.mockReset();
    mockPush.mockReset();
    mockIsTauri.mockReturnValue(true);
    mockAllTools = [mockBuiltInTool];
    mockToolRegistry = [];
    mockPluginStoreState = {
      installedPlugins: [],
      healthMap: {},
      permissionMode: 'compat',
      permissionStates: {},
    };
  });

  it('renders built-in tool by raw tool id on full page', () => {
    render(<ToolDetailPageClient toolId="json-formatter" />);
    expect(screen.getByText('builtin:json-formatter')).toBeInTheDocument();
  });

  it('shows fallback when tool is unknown', () => {
    render(<ToolDetailPageClient toolId="unknown-tool" />);
    expect(screen.getByText('toolbox.search.noResults')).toBeInTheDocument();
  });

  it('shows unsupported-host recovery state for plugin tools outside Tauri', () => {
    mockIsTauri.mockReturnValue(false);
    mockAllTools = [
      {
        id: 'plugin:com.example:run',
        name: 'Plugin Run',
        description: 'Run governed tool',
        icon: 'Plug',
        category: 'developer',
        keywords: [],
        isBuiltIn: false,
        isNew: false,
        isBeta: false,
        pluginTool: {
          pluginId: 'com.example',
          pluginName: 'Example',
          toolId: 'run',
          nameEn: 'Plugin Run',
          nameZh: null,
          descriptionEn: 'Run governed tool',
          descriptionZh: null,
          category: 'developer',
          keywords: [],
          icon: 'Plug',
          entry: 'run',
          uiMode: 'text',
        },
      },
    ];

    render(<ToolDetailPageClient toolId="plugin:com.example:run" />);

    expect(screen.getByText('toolbox.runtime.desktopRequiredDescription')).toBeInTheDocument();
    expect(screen.queryByText('plugin-tool')).not.toBeInTheDocument();
  });

  it('shows unsupported-host recovery state for built-in tools hidden from discoverable toolbox', () => {
    mockIsTauri.mockReturnValue(false);
    mockAllTools = [];
    mockToolRegistry = [
      {
        id: 'desktop-only-tool',
        nameKey: 'toolbox.tools.desktopOnly.name',
        descriptionKey: 'toolbox.tools.desktopOnly.desc',
        icon: 'Laptop',
        category: 'developer',
        keywords: [],
        requiresTauri: true,
        isNew: false,
        component: jest.fn().mockResolvedValue({ default: () => <div>desktop-only</div> }),
      },
    ];

    render(<ToolDetailPageClient toolId="desktop-only-tool" />);

    expect(screen.getByText('toolbox.tools.desktopOnly.name')).toBeInTheDocument();
    expect(screen.getByText('toolbox.runtime.desktopRequiredDescription')).toBeInTheDocument();
  });

  it('shows governance summary for plugin tools in detail page', () => {
    mockAllTools = [
      {
        id: 'plugin:com.example:run',
        name: 'Plugin Run',
        description: 'Run governed tool',
        icon: 'Plug',
        category: 'developer',
        keywords: [],
        isBuiltIn: false,
        isNew: false,
        isBeta: false,
        deprecationWarnings: [
          {
            code: 'capability_deprecated',
            severity: 'warning',
            message: 'deprecated capability',
            guidance: 'use new one',
          },
        ],
        pluginTool: {
          pluginId: 'com.example',
          pluginName: 'Example',
          toolId: 'run',
          nameEn: 'Plugin Run',
          nameZh: null,
          descriptionEn: 'Run governed tool',
          descriptionZh: null,
          category: 'developer',
          keywords: [],
          icon: 'Plug',
          entry: 'run',
          uiMode: 'text',
          capabilityDeclarations: ['process.exec'],
          sdkCapabilityCoverage: [
            {
              capabilityId: 'process',
              permissionGuidance: ['process_exec'],
              hostPrerequisites: ['desktop-host'],
              usagePaths: [],
              requiredPermissions: ['process_exec'],
              recoveryActions: ['manage-plugin'],
              desktopOnly: true,
              status: 'blocked',
              reason: 'Missing permissions: process_exec',
              missingPermissions: ['process_exec'],
            },
          ],
        },
      },
    ];
    mockPluginStoreState = {
      installedPlugins: [
        {
          id: 'com.example',
          name: 'Example',
          enabled: true,
          deprecationWarnings: [],
        },
      ],
      healthMap: {
        'com.example': {
          consecutiveFailures: 0,
          totalCalls: 10,
          failedCalls: 0,
          totalDurationMs: 1000,
          lastError: null,
          autoDisabled: false,
        },
      },
      permissionMode: 'strict',
      permissionStates: {
        'com.example': {
          granted: ['process_exec'],
        },
      },
    };

    render(<ToolDetailPageClient toolId="plugin:com.example:run" />);

    expect(screen.getByText('toolbox.plugin.declaredCapabilities')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.grantedCapabilities')).toBeInTheDocument();
    expect(screen.getAllByText('process.exec').length).toBeGreaterThan(0);
    expect(screen.getByText('deprecated capability use new one')).toBeInTheDocument();
    expect(screen.getByText('Missing permissions: process_exec')).toBeInTheDocument();
  });
});

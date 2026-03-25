import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PluginsPage from './page';

let mockIsDesktop = true;
let mockSearchParamsAction: string | null = null;
let mockError: string | null = null;

let mockFetchPlugins = jest.fn();
let mockGetAllHealth = jest.fn();
let mockScaffoldPlugin = jest.fn();
let mockOpenScaffoldFolder = jest.fn();
let mockOpenScaffoldInVscode = jest.fn();
let mockValidatePlugin = jest.fn();
let mockImportLocalPlugin = jest.fn();
let mockPlugins: Array<Record<string, unknown>> = [];
let mockPluginTools: Array<Record<string, unknown>> = [];
let mockPermissionMode: 'compat' | 'strict' = 'compat';
let mockPermissionStates: Record<string, { granted: string[]; denied: string[]; declared: Record<string, unknown> }> = {};

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'action' ? mockSearchParamsAction : null),
  }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsDesktop,
}));

jest.mock('@/hooks/use-plugins', () => ({
  usePlugins: () => ({
    plugins: mockPlugins,
    pluginTools: mockPluginTools,
    loading: false,
    error: mockError,
    fetchPlugins: mockFetchPlugins,
    installPlugin: jest.fn(),
    importLocalPlugin: mockImportLocalPlugin,
    uninstallPlugin: jest.fn(),
    enablePlugin: jest.fn(),
    disablePlugin: jest.fn(),
    reloadPlugin: jest.fn(),
    getPermissions: jest.fn(),
    grantPermission: jest.fn(),
    revokePermission: jest.fn(),
    scaffoldPlugin: mockScaffoldPlugin,
    openScaffoldFolder: mockOpenScaffoldFolder,
    openScaffoldInVscode: mockOpenScaffoldInVscode,
    validatePlugin: mockValidatePlugin,
    checkUpdate: jest.fn(),
    updatePlugin: jest.fn(),
    getHealth: jest.fn(),
    getAllHealth: mockGetAllHealth,
    resetHealth: jest.fn(),
    getSettingsSchema: jest.fn(),
    getSettingsValues: jest.fn(),
    setSetting: jest.fn(),
    exportData: jest.fn(),
    checkAllUpdates: jest.fn().mockResolvedValue([]),
    updateAll: jest.fn(),
    pendingUpdates: [],
    healthMap: {},
    permissionMode: mockPermissionMode,
    permissionStates: mockPermissionStates,
  }),
}));

jest.mock('@/components/layout/page-header', () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (next: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock('@/components/downloads/destination-picker', () => ({
  DestinationPicker: ({
    value,
    onChange,
    label,
    placeholder,
  }: {
    value: string;
    onChange: (next: string) => void;
    label: string;
    placeholder?: string;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (next: string) => void;
  }) => (
    <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (next: boolean) => void;
    id?: string;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('PluginsPage plugin bootstrap', () => {
  beforeEach(() => {
    mockIsDesktop = true;
    mockSearchParamsAction = null;
    mockError = null;
    mockFetchPlugins = jest.fn();
    mockGetAllHealth = jest.fn();
    mockScaffoldPlugin = jest.fn();
    mockOpenScaffoldFolder = jest.fn();
    mockOpenScaffoldInVscode = jest.fn();
    mockValidatePlugin = jest.fn();
    mockImportLocalPlugin = jest.fn();
    mockPlugins = [];
    mockPluginTools = [];
    mockPermissionMode = 'compat';
    mockPermissionStates = {};
    jest.clearAllMocks();
  });

  it('fetches plugins and health only once in desktop mode across rerenders', async () => {
    const firstFetch = jest.fn();
    const firstHealth = jest.fn();
    const secondFetch = jest.fn();
    const secondHealth = jest.fn();
    mockFetchPlugins = firstFetch;
    mockGetAllHealth = firstHealth;

    const { rerender } = render(<PluginsPage />);
    await waitFor(() => {
      expect(firstFetch).toHaveBeenCalledTimes(1);
      expect(firstHealth).toHaveBeenCalledTimes(1);
    });

    mockFetchPlugins = secondFetch;
    mockGetAllHealth = secondHealth;
    rerender(<PluginsPage />);

    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(firstHealth).toHaveBeenCalledTimes(1);
    expect(secondFetch).not.toHaveBeenCalled();
    expect(secondHealth).not.toHaveBeenCalled();
  });

  it('does not auto-fetch plugins outside desktop mode', () => {
    mockIsDesktop = false;
    render(<PluginsPage />);
    expect(mockFetchPlugins).not.toHaveBeenCalled();
    expect(mockGetAllHealth).not.toHaveBeenCalled();
    expect(screen.queryByText('toolbox.plugin.createPlugin')).not.toBeInTheDocument();
  });

  it('opens install dialog when action intent is install', () => {
    mockSearchParamsAction = 'install';
    render(<PluginsPage />);

    expect(screen.getByText('toolbox.plugin.installDialog')).toBeInTheDocument();
  });

  it('opens scaffold dialog when action intent is scaffold', () => {
    mockSearchParamsAction = 'scaffold';
    render(<PluginsPage />);

    expect(screen.getByPlaceholderText('toolbox.plugin.scaffoldNamePlaceholder')).toBeInTheDocument();
    expect(screen.getByLabelText('toolbox.plugin.scaffoldOutputDir')).toBeInTheDocument();
  });

  it('ignores unsupported action intents and keeps default page usable', () => {
    mockSearchParamsAction = 'unknown';
    render(<PluginsPage />);

    expect(screen.queryByText('toolbox.plugin.installDialog')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('toolbox.plugin.scaffoldNamePlaceholder')).not.toBeInTheDocument();
    expect(screen.getAllByText('toolbox.plugin.install').length).toBeGreaterThan(0);
  });

  it('shows plugin error state in page and supports retry', async () => {
    mockError = 'plugin fetch failed';
    render(<PluginsPage />);

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByText('plugin fetch failed')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetchPlugins).toHaveBeenCalled();
      expect(mockGetAllHealth).toHaveBeenCalled();
    });

    const baselineFetchCalls = mockFetchPlugins.mock.calls.length;
    const baselineHealthCalls = mockGetAllHealth.mock.calls.length;

    fireEvent.click(screen.getByText('common.retry'));

    await waitFor(() => {
      expect(mockFetchPlugins).toHaveBeenCalledTimes(baselineFetchCalls + 1);
      expect(mockGetAllHealth).toHaveBeenCalledTimes(baselineHealthCalls + 1);
    });
  });

  it('shows marketplace return context for store plugins when listing metadata is available', () => {
    mockPlugins = [
      {
        id: 'com.cognia.hello-world',
        name: 'Hello World',
        version: '0.1.0',
        description: 'Rust example plugin.',
        descriptionFallbackNeeded: false,
        authors: [],
        toolCount: 1,
        toolPreviews: [],
        toolPreviewCount: 0,
        hasMoreToolPreviews: false,
        toolPreviewLoading: false,
        enabled: true,
        installedAt: '2026-03-06T00:00:00.000Z',
        updatedAt: null,
        updateUrl: null,
        source: { type: 'store', storeId: 'hello-world-rust' },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
    ];

    render(<PluginsPage />);

    expect(screen.getByText('CogniaLauncher Team')).toBeInTheDocument();
    expect(screen.getByText('Adds richer environment inspection and onboarding hints.')).toBeInTheDocument();
  });

  it('runs local validation before import and blocks invalid plugin import', async () => {
    mockSearchParamsAction = 'install';
    mockValidatePlugin.mockResolvedValue({
      valid: false,
      canImport: false,
      buildRequired: false,
      errors: ['missing plugin.toml'],
      warnings: [],
    });

    render(<PluginsPage />);

    fireEvent.change(screen.getByLabelText('toolbox.plugin.importLabel'), {
      target: { value: 'C:\\tmp\\invalid-plugin' },
    });

    fireEvent.click(screen.getByText('toolbox.plugin.validatePlugin'));

    await waitFor(() => {
      expect(mockValidatePlugin).toHaveBeenCalledWith('C:\\tmp\\invalid-plugin');
    });

    expect(screen.getByText('toolbox.plugin.validationInvalid')).toBeInTheDocument();
    expect(screen.getByText('missing plugin.toml')).toBeInTheDocument();

    fireEvent.click(screen.getByText('toolbox.plugin.import'));

    await waitFor(() => {
      expect(mockValidatePlugin).toHaveBeenCalledTimes(2);
    });
    expect(mockImportLocalPlugin).not.toHaveBeenCalled();
  });

  it('imports local plugin after successful validation', async () => {
    mockSearchParamsAction = 'install';
    mockValidatePlugin.mockResolvedValue({
      valid: true,
      canImport: true,
      buildRequired: false,
      errors: [],
      warnings: [],
    });
    mockImportLocalPlugin.mockResolvedValue('com.example.plugin');

    render(<PluginsPage />);

    fireEvent.change(screen.getByLabelText('toolbox.plugin.importLabel'), {
      target: { value: 'C:\\tmp\\valid-plugin' },
    });
    fireEvent.click(screen.getByText('toolbox.plugin.import'));

    await waitFor(() => {
      expect(mockValidatePlugin).toHaveBeenCalledWith('C:\\tmp\\valid-plugin');
      expect(mockImportLocalPlugin).toHaveBeenCalledWith('C:\\tmp\\valid-plugin');
    });
  });

  it('shows scaffold success action panel and allows open actions', async () => {
    mockScaffoldPlugin.mockResolvedValue({
      pluginDir: 'C:\\tmp\\plugin-sample',
      filesCreated: ['plugin.toml'],
      lifecycleProfile: 'external',
      handoff: {
        profile: 'external',
        artifactPath: 'C:\\tmp\\plugin-sample\\plugin.wasm',
        buildCommands: ['pnpm build'],
        nextSteps: ['Build plugin.wasm', 'Continue to import'],
        importPath: 'C:\\tmp\\plugin-sample',
        importRequiresBuild: true,
        lifecycleManifestPath: 'C:\\tmp\\plugin-sample\\cognia.scaffold.json',
      },
    });
    mockOpenScaffoldFolder.mockResolvedValue({
      openedWith: 'folder',
      fallbackUsed: false,
      message: 'ok',
    });
    mockOpenScaffoldInVscode.mockResolvedValue({
      openedWith: 'vscode',
      fallbackUsed: false,
      message: 'ok',
    });

    render(<PluginsPage />);

    fireEvent.click(screen.getByText('toolbox.plugin.createPlugin'));

    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldNamePlaceholder'), {
      target: { value: 'Sample Plugin' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldIdPlaceholder'), {
      target: { value: 'com.example.sample' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldDescPlaceholder'), {
      target: { value: 'desc' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldAuthorPlaceholder'), {
      target: { value: 'author' },
    });
    fireEvent.change(screen.getByLabelText('toolbox.plugin.scaffoldOutputDir'), {
      target: { value: 'C:\\tmp' },
    });

    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldCreate'));

    await waitFor(() => {
      expect(mockScaffoldPlugin).toHaveBeenCalledTimes(1);
    });
    expect(mockScaffoldPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        templateOptions: expect.objectContaining({
          includeUnifiedContractSamples: true,
          contractTemplate: 'minimal',
          schemaPreset: 'basic-form',
          includeValidationGuidance: true,
          includeStarterTests: false,
          includeInkCompanion: false,
        }),
      }),
    );

    expect(screen.getByText('toolbox.plugin.scaffoldCreatedTitle')).toBeInTheDocument();
    expect(screen.getByText('C:\\tmp\\plugin-sample')).toBeInTheDocument();

    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldOpenFolder'));
    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldOpenInVscode'));

    await waitFor(() => {
      expect(mockOpenScaffoldFolder).toHaveBeenCalledWith('C:\\tmp\\plugin-sample');
      expect(mockOpenScaffoldInVscode).toHaveBeenCalledWith('C:\\tmp\\plugin-sample');
    });
  });

  it('continues external scaffold into local import with prefilled path and build-required guidance', async () => {
    mockScaffoldPlugin.mockResolvedValue({
      pluginDir: 'C:\\tmp\\plugin-sample',
      filesCreated: ['plugin.toml', 'cognia.scaffold.json'],
      lifecycleProfile: 'external',
      handoff: {
        profile: 'external',
        artifactPath: 'C:\\tmp\\plugin-sample\\plugin.wasm',
        buildCommands: ['pnpm build'],
        nextSteps: ['Build plugin.wasm', 'Continue to import'],
        importPath: 'C:\\tmp\\plugin-sample',
        importRequiresBuild: true,
        lifecycleManifestPath: 'C:\\tmp\\plugin-sample\\cognia.scaffold.json',
      },
    });
    mockValidatePlugin.mockResolvedValue({
      valid: true,
      canImport: false,
      buildRequired: true,
      missingArtifactPath: 'C:\\tmp\\plugin-sample\\plugin.wasm',
      errors: [],
      warnings: ['No plugin.wasm found — plugin needs to be built first'],
    });

    render(<PluginsPage />);

    fireEvent.click(screen.getByText('toolbox.plugin.createPlugin'));
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldNamePlaceholder'), {
      target: { value: 'Sample Plugin' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldIdPlaceholder'), {
      target: { value: 'com.example.sample' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldDescPlaceholder'), {
      target: { value: 'desc' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldAuthorPlaceholder'), {
      target: { value: 'author' },
    });
    fireEvent.change(screen.getByLabelText('toolbox.plugin.scaffoldOutputDir'), {
      target: { value: 'C:\\tmp' },
    });

    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldCreate'));

    await waitFor(() => {
      expect(screen.getByText('toolbox.plugin.scaffoldContinueToImport')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldContinueToImport'));

    expect(screen.getByLabelText('toolbox.plugin.importLabel')).toHaveValue('C:\\tmp\\plugin-sample');

    fireEvent.click(screen.getByText('toolbox.plugin.import'));

    await waitFor(() => {
      expect(mockValidatePlugin).toHaveBeenCalledWith('C:\\tmp\\plugin-sample');
    });

    expect(mockImportLocalPlugin).not.toHaveBeenCalled();
    expect(screen.getByText('toolbox.plugin.validationBuildRequired')).toBeInTheDocument();
    expect(screen.getAllByText('pnpm build').length).toBeGreaterThan(0);
  });

  it('submits builtin lifecycle scaffolds and shows builtin onboarding guidance', async () => {
    mockScaffoldPlugin.mockResolvedValue({
      pluginDir: 'D:\\Project\\CogniaLauncher\\plugins\\typescript\\sample',
      filesCreated: ['plugin.toml', 'catalog-entry.sample.json', 'cognia.scaffold.json'],
      lifecycleProfile: 'builtin',
      handoff: {
        profile: 'builtin',
        artifactPath: 'D:\\Project\\CogniaLauncher\\plugins\\typescript\\sample\\plugin.wasm',
        buildCommands: ['pnpm --filter cognia-sample-plugin build'],
        nextSteps: ['Add entry to plugins/manifest.json', 'Run pnpm plugins:checksums', 'Run pnpm plugins:validate'],
        importRequiresBuild: true,
        lifecycleManifestPath: 'D:\\Project\\CogniaLauncher\\plugins\\typescript\\sample\\cognia.scaffold.json',
        builtinCatalogPath: 'plugins/manifest.json',
        builtinChecksumCommand: 'pnpm plugins:checksums',
        builtinValidationCommand: 'pnpm plugins:validate',
      },
    });

    render(<PluginsPage />);

    fireEvent.click(screen.getByText('toolbox.plugin.createPlugin'));
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldNamePlaceholder'), {
      target: { value: 'Built-in Plugin' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldIdPlaceholder'), {
      target: { value: 'com.cognia.builtin.sample' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldDescPlaceholder'), {
      target: { value: 'desc' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldAuthorPlaceholder'), {
      target: { value: 'author' },
    });
    fireEvent.change(screen.getByLabelText('toolbox.plugin.scaffoldOutputDir'), {
      target: { value: 'D:\\Project\\CogniaLauncher\\plugins' },
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'builtin' } });

    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldCreate'));

    await waitFor(() => {
      expect(mockScaffoldPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          lifecycleProfile: 'builtin',
        }),
      );
    });

    expect(screen.getByText('toolbox.plugin.scaffoldBuiltinNextStepsTitle')).toBeInTheDocument();
    expect(screen.getByText('plugins/manifest.json')).toBeInTheDocument();
    expect(screen.queryByText('toolbox.plugin.scaffoldContinueToImport')).not.toBeInTheDocument();
  });

  it('submits advanced scaffold inputs and renders advanced handoff guidance', async () => {
    mockScaffoldPlugin.mockResolvedValue({
      pluginDir: 'C:\\tmp\\plugin-advanced',
      filesCreated: ['plugin.toml', 'ui/index.html', 'cognia.scaffold.json'],
      lifecycleProfile: 'external',
      handoff: {
        profile: 'external',
        artifactPath: 'C:\\tmp\\plugin-advanced\\plugin.wasm',
        buildCommands: ['pnpm build'],
        nextSteps: [
          'Review ui/index.html and keep [ui].entry assets aligned with iframe tool behavior.',
          'Review the generated cognia_on_event callback stub and align listen_events with real host events.',
        ],
        importPath: 'C:\\tmp\\plugin-advanced',
        importRequiresBuild: true,
        lifecycleManifestPath: 'C:\\tmp\\plugin-advanced\\cognia.scaffold.json',
      },
    });

    render(<PluginsPage />);

    fireEvent.click(screen.getByText('toolbox.plugin.createPlugin'));
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldNamePlaceholder'), {
      target: { value: 'Advanced Plugin' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldIdPlaceholder'), {
      target: { value: 'com.example.advanced' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldDescPlaceholder'), {
      target: { value: 'advanced desc' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldAuthorPlaceholder'), {
      target: { value: 'author' },
    });
    fireEvent.change(screen.getByLabelText('toolbox.plugin.scaffoldOutputDir'), {
      target: { value: 'C:\\tmp' },
    });

    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldAdvanced'));
    fireEvent.change(screen.getByLabelText('toolbox.plugin.scaffoldToolExtensionPoint'), {
      target: { value: 'tool-iframe-ui' },
    });
    fireEvent.click(screen.getByLabelText('toolbox.plugin.scaffoldExtensionEventListener'));
    fireEvent.click(screen.getByLabelText('toolbox.plugin.scaffoldExtensionSettingsSchema'));
    fireEvent.click(
      within(
        screen.getByText('toolbox.plugin.scaffoldIncludeInkCompanion').closest('div')!,
      ).getByRole('checkbox'),
    );
    fireEvent.click(screen.getByLabelText('toolbox.plugin.permUiFeedback'));
    fireEvent.click(screen.getByLabelText('toolbox.plugin.permUiDialog'));
    fireEvent.change(screen.getByLabelText('toolbox.plugin.scaffoldHttpDomains'), {
      target: { value: 'localhost, api.example.com' },
    });

    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldCreate'));

    await waitFor(() => {
      expect(mockScaffoldPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionPoints: [
            'tool-iframe-ui',
            'event-listener',
            'settings-schema',
          ],
          permissions: expect.objectContaining({
            uiFeedback: true,
            uiDialog: true,
            http: ['localhost', 'api.example.com'],
          }),
          templateOptions: expect.objectContaining({
            includeInkCompanion: true,
          }),
        }),
      );
    });

    expect(
      screen.getByText(
        'Review ui/index.html and keep [ui].entry assets aligned with iframe tool behavior.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Review the generated cognia_on_event callback stub and align listen_events with real host events.',
      ),
    ).toBeInTheDocument();
  });

  it('shows compatibility guidance when JavaScript scaffolding limits advanced extension points', () => {
    render(<PluginsPage />);

    fireEvent.click(screen.getByText('toolbox.plugin.createPlugin'));
    fireEvent.click(screen.getByText('toolbox.plugin.scaffoldAdvanced'));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'javascript' } });

    expect(
      screen.getByText('toolbox.plugin.scaffoldExtensionPointsJavascriptHint'),
    ).toBeInTheDocument();
  });

  it('blocks builtin scaffold submit when output path points to framework subdirectory', async () => {
    render(<PluginsPage />);

    fireEvent.click(screen.getByText('toolbox.plugin.createPlugin'));
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldNamePlaceholder'), {
      target: { value: 'Built-in Plugin' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldIdPlaceholder'), {
      target: { value: 'com.cognia.builtin.sample' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldDescPlaceholder'), {
      target: { value: 'desc' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.plugin.scaffoldAuthorPlaceholder'), {
      target: { value: 'author' },
    });
    fireEvent.change(screen.getByLabelText('toolbox.plugin.scaffoldOutputDir'), {
      target: { value: 'D:\\Project\\CogniaLauncher\\plugins\\typescript' },
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'builtin' } });

    const submitButton = screen.getByText('toolbox.plugin.scaffoldCreate');
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(mockScaffoldPlugin).not.toHaveBeenCalled();
  });

  it('shows policy mode, governance warnings, and capability transparency for plugin cards/details', () => {
    mockPermissionMode = 'strict';
    mockPlugins = [
      {
        id: 'com.example.governed',
        name: 'Governed Plugin',
        version: '0.1.0',
        description: 'governed plugin',
        authors: ['Alice'],
        toolCount: 1,
        enabled: true,
        installedAt: '2026-03-01T00:00:00.000Z',
        updatedAt: null,
        updateUrl: null,
        source: { type: 'local', path: 'C:/plugins/governed' },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
        deprecationWarnings: [
          {
            code: 'capability_deprecated',
            severity: 'warning',
            message: 'deprecated capability',
            guidance: 'use new one',
          },
        ],
      },
    ];
    mockPluginTools = [
      {
        pluginId: 'com.example.governed',
        pluginName: 'Governed Plugin',
        toolId: 'run',
        nameEn: 'Run',
        nameZh: null,
        descriptionEn: 'run tool',
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
    ];
    mockPermissionStates = {
      'com.example.governed': {
        declared: {
          uiFeedback: false,
          uiDialog: false,
          uiFilePicker: false,
          uiNavigation: false,
          fsRead: [],
          fsWrite: [],
          http: [],
          configRead: true,
          configWrite: false,
          envRead: false,
          pkgSearch: false,
          pkgInstall: false,
          clipboard: false,
          notification: false,
          processExec: true,
        },
        granted: ['process_exec'],
        denied: [],
      },
    };

    render(<PluginsPage />);

    expect(screen.getByText('toolbox.plugin.permissionPolicyModeTitle')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.permissionPolicyModeStrict')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.deprecationWarningsCount')).toBeInTheDocument();
    expect(screen.getByText('deprecated capability')).toBeInTheDocument();

    fireEvent.click(screen.getByText('toolbox.plugin.details'));

    expect(screen.getByText('toolbox.plugin.declaredCapabilities')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.grantedCapabilities')).toBeInTheDocument();
    expect(screen.getAllByText('process.exec').length).toBeGreaterThan(0);
    expect(screen.getByText('Missing permissions: process_exec')).toBeInTheDocument();
  });

  it('renders description fallback and tool preview states on cards, and full tools in detail view', () => {
    mockPlugins = [
      {
        id: 'com.example.loading',
        name: 'Loading Plugin',
        version: '1.0.0',
        description: '',
        descriptionFallbackNeeded: true,
        authors: [],
        toolCount: 2,
        toolPreviews: [],
        toolPreviewCount: 2,
        hasMoreToolPreviews: false,
        toolPreviewLoading: true,
        enabled: true,
        installedAt: '2026-03-01T00:00:00.000Z',
        updatedAt: null,
        updateUrl: null,
        source: { type: 'local', path: 'C:/plugins/loading' },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
      {
        id: 'com.example.empty',
        name: 'Empty Plugin',
        version: '1.0.0',
        description: 'empty plugin',
        descriptionFallbackNeeded: false,
        authors: [],
        toolCount: 0,
        toolPreviews: [],
        toolPreviewCount: 0,
        hasMoreToolPreviews: false,
        toolPreviewLoading: false,
        enabled: true,
        installedAt: '2026-03-01T00:00:00.000Z',
        updatedAt: null,
        updateUrl: null,
        source: { type: 'local', path: 'C:/plugins/empty' },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
      {
        id: 'com.example.overflow',
        name: 'Overflow Plugin',
        version: '1.0.0',
        description: 'overflow plugin',
        descriptionFallbackNeeded: false,
        authors: [],
        toolCount: 4,
        toolPreviews: [
          {
            toolId: 'tool-1',
            name: 'Tool One',
            description: 'First preview tool',
            descriptionFallbackNeeded: false,
            entry: 'tool_one',
            uiMode: 'text',
          },
          {
            toolId: 'tool-2',
            name: 'Tool Two',
            description: null,
            descriptionFallbackNeeded: true,
            entry: 'tool_two',
            uiMode: 'text',
          },
          {
            toolId: 'tool-3',
            name: 'Tool Three',
            description: 'Third preview tool',
            descriptionFallbackNeeded: false,
            entry: 'tool_three',
            uiMode: 'text',
          },
        ],
        toolPreviewCount: 4,
        hasMoreToolPreviews: true,
        toolPreviewLoading: false,
        enabled: true,
        installedAt: '2026-03-01T00:00:00.000Z',
        updatedAt: null,
        updateUrl: null,
        source: { type: 'local', path: 'C:/plugins/overflow' },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
    ];
    mockPluginTools = [
      {
        pluginId: 'com.example.overflow',
        pluginName: 'Overflow Plugin',
        toolId: 'tool-1',
        nameEn: 'Tool One',
        nameZh: null,
        descriptionEn: 'First preview tool',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'tool_one',
        uiMode: 'text',
      },
      {
        pluginId: 'com.example.overflow',
        pluginName: 'Overflow Plugin',
        toolId: 'tool-2',
        nameEn: 'Tool Two',
        nameZh: null,
        descriptionEn: '  ',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'tool_two',
        uiMode: 'text',
      },
      {
        pluginId: 'com.example.overflow',
        pluginName: 'Overflow Plugin',
        toolId: 'tool-3',
        nameEn: 'Tool Three',
        nameZh: null,
        descriptionEn: 'Third preview tool',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'tool_three',
        uiMode: 'text',
      },
      {
        pluginId: 'com.example.overflow',
        pluginName: 'Overflow Plugin',
        toolId: 'tool-4',
        nameEn: 'Tool Four',
        nameZh: null,
        descriptionEn: 'Fourth full-detail tool',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'tool_four',
        uiMode: 'text',
      },
    ];

    render(<PluginsPage />);

    expect(screen.getByText('toolbox.plugin.descriptionFallback')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.toolPreviewLoading')).toBeInTheDocument();
    expect(screen.getByText('toolbox.plugin.toolPreviewEmpty')).toBeInTheDocument();
    expect(screen.getAllByText('toolbox.plugin.toolPreviewMore').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.plugin.toolDescriptionFallback').length).toBeGreaterThan(0);

    const detailButtons = screen.getAllByText('toolbox.plugin.details');
    fireEvent.click(detailButtons[2]);

    expect(screen.getByText('Tool Four')).toBeInTheDocument();
    expect(screen.getAllByText('toolbox.plugin.toolDescriptionFallback').length).toBeGreaterThan(0);
  });
});

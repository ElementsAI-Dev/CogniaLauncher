import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './page';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { AppSettings } from '@/lib/stores/settings';

const mockUpdateConfigValue = jest.fn();
const mockResetConfig = jest.fn();
const mockFetchConfig = jest.fn();
const mockFetchPlatformInfo = jest.fn();
const mockSetAppSettings = jest.fn();
const mockSetTheme = jest.fn();
const mockSetAccentColor = jest.fn();
const mockSetReducedMotion = jest.fn();

const baseConfig: Record<string, string> = {
  'general.parallel_downloads': '4',
  'general.metadata_cache_ttl': '3600',
  'general.resolve_strategy': 'latest',
  'general.auto_update_metadata': 'true',
  'network.timeout': '30',
  'network.retries': '3',
  'network.proxy': '',
  'security.allow_http': 'false',
  'security.verify_certificates': 'true',
  'security.allow_self_signed': 'false',
  'mirrors.npm': 'https://registry.npmjs.org',
  'mirrors.pypi': 'https://pypi.org/simple',
  'mirrors.crates': 'https://crates.io',
  'mirrors.go': 'https://proxy.golang.org',
  'paths.root': '',
  'paths.cache': '',
  'paths.environments': '',
  'provider_settings.disabled_providers': '',
};

jest.mock('@/hooks/use-settings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('@/lib/stores/settings', () => ({
  useSettingsStore: jest.fn(),
}));

jest.mock('@/lib/stores/appearance', () => ({
  useAppearanceStore: jest.fn(),
}));

jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn().mockReturnValue(false),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

const mockMessages = {
  en: {
    common: {
      reset: 'Reset',
      cancel: 'Cancel',
      unknown: 'Unknown',
    },
    validation: {
      mustBeNumber: 'Must be a number',
      min: 'Minimum value is {min}',
      max: 'Maximum value is {max}',
      invalidFormat: 'Invalid format',
    },
    settings: {
      title: 'Settings',
      description: 'Manage application settings',
      saveChanges: 'Save Changes',
      saving: 'Saving...',
      savingProgress: 'Saving {current} of {total}...',
      settingsSaved: 'Settings saved',
      settingsReset: 'Settings reset',
      saveFailed: 'Save failed',
      partialSaveError: '{count} setting(s) failed to save',
      validationError: 'Please fix validation errors before saving',
      noChanges: 'No changes to save',
      resetConfirmTitle: 'Reset Settings',
      resetConfirmDesc: 'This will reset all settings',
      resetFailed: 'Failed to reset settings',
      unsavedChanges: 'You have unsaved changes',
      shortcutHint: 'Press Ctrl+S to save, Esc to discard',
      import: 'Import',
      export: 'Export',
      importSettings: 'Import settings',
      exportSuccess: 'Settings exported successfully',
      importSuccess: 'Settings imported successfully',
      importFailed: 'Failed to import settings',
      importInvalidFormat: 'Invalid settings file format',
      general: 'General',
      generalDesc: 'General application settings',
      parallelDownloads: 'Parallel Downloads',
      parallelDownloadsDesc: 'Number of concurrent downloads',
      metadataCacheTtl: 'Metadata Cache TTL',
      metadataCacheTtlDesc: 'Seconds before metadata cache expires',
      resolveStrategy: 'Resolve Strategy',
      resolveStrategyDesc: 'How versions are resolved',
      resolveLatest: 'Latest',
      resolveMinimal: 'Minimal',
      resolveLocked: 'Locked',
      resolvePreferLocked: 'Prefer Locked',
      autoUpdateMetadata: 'Auto Update Metadata',
      autoUpdateMetadataDesc: 'Automatically refresh metadata',
      network: 'Network',
      networkDesc: 'Network and proxy settings',
      timeout: 'Timeout',
      timeoutDesc: 'Request timeout in seconds',
      retries: 'Retries',
      retriesDesc: 'Number of retry attempts',
      proxy: 'Proxy',
      proxyDesc: 'HTTP proxy URL',
      security: 'Security',
      securityDesc: 'Security and verification settings',
      allowHttp: 'Allow HTTP',
      allowHttpDesc: 'Allow insecure HTTP connections',
      verifyCerts: 'Verify Certificates',
      verifyCertsDesc: 'Validate SSL/TLS certificates',
      allowSelfSigned: 'Allow Self-Signed',
      allowSelfSignedDesc: 'Allow self-signed certificates',
      mirrors: 'Mirrors',
      mirrorsDesc: 'Configure package registry mirrors',
      mirrorPresets: 'Presets',
      selectPreset: 'Select Preset',
      npmRegistry: 'NPM Registry',
      npmRegistryDesc: 'NPM package registry URL',
      pypiIndex: 'PyPI Index',
      pypiIndexDesc: 'Python package index URL',
      cratesRegistry: 'Crates Registry',
      cratesRegistryDesc: 'Rust crates registry URL',
      goProxy: 'Go Proxy',
      goProxyDesc: 'Go module proxy URL',
      mirrorEnabled: 'Enabled',
      mirrorEnabledDesc: 'Use this mirror for requests',
      mirrorPriority: 'Priority',
      mirrorPriorityDesc: 'Higher priority mirrors are preferred',
      mirrorVerifySsl: 'Verify SSL',
      mirrorVerifySslDesc: 'Verify TLS certificates for this mirror',
      appearance: 'Appearance',
      appearanceDesc: 'Customize the look and feel',
      theme: 'Theme',
      themeDesc: 'Choose between light, dark, or system theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
      language: 'Language',
      languageDesc: 'Select your preferred language',
      english: 'English',
      chinese: '中文',
      accentColor: 'Accent Color',
      accentColorDesc: 'Choose the primary accent color',
      reducedMotion: 'Reduced Motion',
      reducedMotionDesc: 'Disable animations and transitions',
      updates: 'Updates',
      updatesDesc: 'Configure update checks and notifications',
      checkUpdatesOnStart: 'Check on Start',
      checkUpdatesOnStartDesc: 'Automatically check for updates on start',
      autoInstallUpdates: 'Auto Install Updates',
      autoInstallUpdatesDesc: 'Automatically install updates when available',
      notifyOnUpdates: 'Notify on Updates',
      notifyOnUpdatesDesc: 'Show a notification when updates are available',
      paths: 'Paths',
      pathsDesc: 'Override default storage locations',
      pathRoot: 'Root Directory',
      pathRootDesc: 'Base directory for data',
      pathRootPlaceholder: 'Leave empty to use default',
      pathCache: 'Cache Directory',
      pathCacheDesc: 'Directory for downloads and metadata',
      pathCachePlaceholder: 'Leave empty to use default',
      pathEnvironments: 'Environments Directory',
      pathEnvironmentsDesc: 'Directory for environments',
      pathEnvironmentsPlaceholder: 'Leave empty to use default',
      providerSettings: 'Provider Settings',
      providerSettingsDesc: 'Control provider availability globally',
      disabledProviders: 'Disabled Providers',
      disabledProvidersDesc: 'Comma-separated provider IDs to disable',
      disabledProvidersPlaceholder: 'e.g., brew, apt',
      disabledProvidersHint: 'Changes apply after restarting the app',
      systemInfo: 'System Information',
      systemInfoDesc: 'Current system details',
      operatingSystem: 'Operating System',
      architecture: 'Architecture',
    },
  },
  zh: {
    common: {},
    validation: {},
    settings: {},
  },
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider messages={mockMessages as never}>
      {children}
    </LocaleProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

function setupMocks(overrides?: Partial<{ config: Record<string, string>; appSettings: AppSettings; loading: boolean }>) {
  const { useSettings } = jest.requireMock('@/hooks/use-settings') as {
    useSettings: jest.Mock;
  };
  const { useSettingsStore } = jest.requireMock('@/lib/stores/settings') as {
    useSettingsStore: jest.Mock;
  };
  const { useAppearanceStore } = jest.requireMock('@/lib/stores/appearance') as {
    useAppearanceStore: jest.Mock;
  };
  const { useTheme } = jest.requireMock('next-themes') as {
    useTheme: jest.Mock;
  };

  const appSettings = overrides?.appSettings ?? {
    checkUpdatesOnStart: true,
    autoInstallUpdates: false,
    notifyOnUpdates: true,
  };

  useSettings.mockReturnValue({
    config: overrides?.config ?? baseConfig,
    loading: overrides?.loading ?? false,
    error: null,
    fetchConfig: mockFetchConfig.mockResolvedValue(baseConfig),
    updateConfigValue: mockUpdateConfigValue.mockResolvedValue(undefined),
    resetConfig: mockResetConfig.mockResolvedValue(undefined),
    platformInfo: { os: 'Windows', arch: 'x64' },
    fetchPlatformInfo: mockFetchPlatformInfo.mockResolvedValue({ os: 'Windows', arch: 'x64' }),
  });

  useSettingsStore.mockReturnValue({
    appSettings,
    setAppSettings: mockSetAppSettings,
  });

  useAppearanceStore.mockReturnValue({
    accentColor: 'blue',
    setAccentColor: mockSetAccentColor,
    reducedMotion: false,
    setReducedMotion: mockSetReducedMotion,
  });

  useTheme.mockReturnValue({
    theme: 'light',
    setTheme: mockSetTheme,
    resolvedTheme: 'light',
  });
}

function mockFileReaderResponse(payload: Record<string, unknown>) {
  class MockFileReader {
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

    readAsText() {
      if (this.onload) {
        this.onload({ target: { result: JSON.stringify(payload) } } as ProgressEvent<FileReader>);
      }
    }
  }

  Object.defineProperty(global, 'FileReader', {
    writable: true,
    value: MockFileReader,
  });
}

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    mockUpdateConfigValue.mockResolvedValue(undefined);
    mockResetConfig.mockResolvedValue(undefined);
    mockFetchConfig.mockResolvedValue(baseConfig);
    mockFetchPlatformInfo.mockResolvedValue({ os: 'Windows', arch: 'x64' });
    mockSetAppSettings.mockClear();

    Object.defineProperty(global.URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:settings'),
    });
    Object.defineProperty(global.URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    });

    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders settings sections after loading', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('saves changed config values', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const parallelDownloads = screen.getByLabelText('Parallel Downloads');
    fireEvent.change(parallelDownloads, { target: { value: '6' } });

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateConfigValue).toHaveBeenCalledWith('general.parallel_downloads', '6');
    });
  });

  it('exports settings payload', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /export/i }));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Settings exported successfully');
  });

  it('imports settings and updates app settings', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const importPayload = {
      settings: {
        'network.timeout': '20',
      },
      appSettings: {
        checkUpdatesOnStart: false,
      },
    };

    mockFileReaderResponse(importPayload);

    const fileInput = screen.getByLabelText('Import settings');
    const file = new File([JSON.stringify(importPayload)], 'settings.json', { type: 'application/json' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSetAppSettings).toHaveBeenCalledWith({ checkUpdatesOnStart: false });
    });
    expect(toast.success).toHaveBeenCalledWith('Settings imported successfully');
  });

  it('updates app settings toggles', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const updateToggle = screen.getByRole('switch', { name: /check on start/i });
    await userEvent.click(updateToggle);

    expect(mockSetAppSettings).toHaveBeenCalledWith({ checkUpdatesOnStart: false });
  });

  it('resets settings through the confirmation dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const resetButton = screen.getAllByRole('button', { name: /reset/i })[0];
    await user.click(resetButton);

    const dialog = await screen.findByRole('dialog');
    const confirmReset = within(dialog).getByRole('button', { name: /^reset$/i });
    await user.click(confirmReset);

    await waitFor(() => {
      expect(mockResetConfig).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith('Settings reset');
  });

  it('triggers reset via Ctrl+R shortcut', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'r', ctrlKey: true });

    await waitFor(() => {
      expect(mockResetConfig).toHaveBeenCalled();
    });
  });

  it('saves changes via Ctrl+S shortcut and discards via Escape', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const parallelDownloads = screen.getByLabelText('Parallel Downloads');
    fireEvent.change(parallelDownloads, { target: { value: '7' } });

    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(mockUpdateConfigValue).toHaveBeenCalledWith('general.parallel_downloads', '7');
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
    });
    expect((parallelDownloads as HTMLInputElement).value).toBe('4');
  });

  it('does not reset via Ctrl+R when focused on an input', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const parallelDownloads = screen.getByLabelText('Parallel Downloads');
    parallelDownloads.focus();

    fireEvent.keyDown(parallelDownloads, { key: 'r', ctrlKey: true });

    await waitFor(() => {
      expect(mockResetConfig).not.toHaveBeenCalled();
    });
  });

  it('does not save via Ctrl+S when loading', async () => {
    setupMocks({ loading: true });
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const parallelDownloads = screen.getByLabelText('Parallel Downloads');
    fireEvent.change(parallelDownloads, { target: { value: '9' } });

    fireEvent.keyDown(document, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(mockUpdateConfigValue).not.toHaveBeenCalled();
    });
  });
});

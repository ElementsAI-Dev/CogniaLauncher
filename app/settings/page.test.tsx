import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './page';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { useOnboardingStore } from '@/lib/stores/onboarding';
import { toast } from 'sonner';
import type { AppSettings } from '@/lib/stores/settings';
import { DEFAULT_SIDEBAR_ITEM_ORDER } from '@/lib/sidebar/order';

jest.setTimeout(30000);

const mockUpdateConfigValue = jest.fn();
const mockResetConfig = jest.fn();
const mockFetchConfig = jest.fn();
const mockFetchPlatformInfo = jest.fn();
const mockSetAppSettings = jest.fn();
const mockSetTheme = jest.fn();
const mockSetAccentColor = jest.fn();
const mockSetChartColorTheme = jest.fn();
const mockSetInterfaceRadius = jest.fn();
const mockSetInterfaceDensity = jest.fn();
const mockSetReducedMotion = jest.fn();
const mockSetWindowEffect = jest.fn();
const mockResetAppearance = jest.fn();
const mockCreatePreset = jest.fn();
const mockRenamePreset = jest.fn();
const mockDeletePreset = jest.fn();
const mockSetActivePresetId = jest.fn();
const mockApplyPreset = jest.fn();
const mockReplacePresetCollection = jest.fn();
const mockConfigExport = jest.fn();
const mockConfigImport = jest.fn();
const mockWindowEffectApply = jest.fn();
const mockWindowEffectGetSupported = jest.fn();

const baseConfig: Record<string, string> = {
  'general.parallel_downloads': '4',
  'general.min_install_space_mb': '100',
  'general.metadata_cache_ttl': '3600',
  'general.resolve_strategy': 'latest',
  'general.auto_update_metadata': 'true',
  'updates.check_on_start': 'true',
  'updates.auto_install': 'false',
  'updates.notify': 'true',
  'updates.source_mode': 'official',
  'updates.custom_endpoints': '[]',
  'updates.fallback_to_official': 'true',
  'tray.minimize_to_tray': 'true',
  'tray.start_minimized': 'false',
  'tray.show_notifications': 'true',
  'tray.notification_level': 'all',
  'tray.click_behavior': 'toggle_window',
  'backup.auto_backup_enabled': 'true',
  'backup.auto_backup_interval_hours': '24',
  'backup.max_backups': '10',
  'backup.retention_days': '30',
  'startup.scan_environments': 'true',
  'startup.scan_packages': 'true',
  'startup.max_concurrent_scans': '4',
  'startup.startup_timeout_secs': '45',
  'startup.integrity_check': 'true',
  'network.timeout': '30',
  'network.retries': '3',
  'network.proxy': '',
  'appearance.theme': 'light',
  'appearance.language': 'en',
  'appearance.accent_color': 'blue',
  'appearance.chart_color_theme': 'default',
  'appearance.interface_radius': '0.625',
  'appearance.interface_density': 'comfortable',
  'appearance.reduced_motion': 'false',
  'appearance.window_effect': 'auto',
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
  configExport: (...args: unknown[]) => mockConfigExport(...args),
  configImport: (...args: unknown[]) => mockConfigImport(...args),
  windowEffectApply: (...args: unknown[]) => mockWindowEffectApply(...args),
  windowEffectGetSupported: (...args: unknown[]) => mockWindowEffectGetSupported(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/lib/clipboard', () => ({
  readClipboard: jest.fn().mockResolvedValue(''),
  writeClipboard: jest.fn().mockResolvedValue(undefined),
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
      importFromClipboard: 'Import from Clipboard',
      importFromFile: 'Import from File',
      exportToClipboard: 'Copy to Clipboard',
      exportAsFile: 'Export as File',
      clipboardEmpty: 'Clipboard is empty',
      importPreviewTitle: 'Review Imported Settings',
      importPreviewDesc: 'Confirm the detected changes before applying this import.',
      importPreviewChangedCount: '{count} setting key(s) will change',
      importPreviewAffectedSections: 'Affected sections',
      importConfirmApply: 'Apply Import',
      pendingSaveItems: '{count} item(s) in pending save snapshot',
      refreshConflictDetected: 'Detected baseline refresh while you had local drafts',
      saveRetryHint: '{count} setting key(s) failed to save',
      retryFailedOnly: 'Retry Failed Items',
      general: 'General',
      generalDesc: 'General application settings',
      parallelDownloads: 'Parallel Downloads',
      parallelDownloadsDesc: 'Number of concurrent downloads',
      minInstallSpace: 'Minimum Install Space',
      minInstallSpaceDesc: 'Minimum free disk space required',
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
      downloadSpeedLimit: 'Download Speed Limit',
      downloadSpeedLimitDesc: 'Maximum download speed in bytes/sec',
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
      customizationWorkbenchTitle: 'Customization Workbench',
      customizationWorkbenchDesc: 'Create and apply appearance presets',
      customizationWorkbenchChanged: 'Differs from preset',
      customizationPresetSelect: 'Preset',
      customizationPresetApply: 'Apply Preset',
      customizationPresetName: 'Preset Name',
      customizationPresetNamePlaceholder: 'Enter preset name',
      customizationPresetSave: 'Save Preset',
      customizationPresetRename: 'Rename Preset',
      customizationPresetDelete: 'Delete Preset',
      customizationResetAppearance: 'Reset Appearance Group',
      customizationResetAppearanceHint: 'Only appearance fields are reset.',
      customizationPresetApplied: 'Applied preset {name}',
      customizationPresetSaved: 'Saved preset {name}',
      customizationPresetRenamed: 'Renamed preset {name}',
      customizationPresetDeleted: 'Deleted preset {name}',
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
      chartColorTheme: 'Chart Color Theme',
      chartThemeDefault: 'Default',
      chartThemeVibrant: 'Vibrant',
      chartThemePastel: 'Pastel',
      chartThemeOcean: 'Ocean',
      chartThemeSunset: 'Sunset',
      chartThemeMonochrome: 'Monochrome',
      reducedMotion: 'Reduced Motion',
      reducedMotionDesc: 'Disable animations and transitions',
      windowEffect: 'Window Effect',
      windowEffectAuto: 'Auto (Recommended)',
      windowEffectNone: 'None',
      windowEffectMica: 'Mica (Windows 11)',
      windowEffectMicaTabbed: 'Mica Tabbed (Windows 11)',
      windowEffectAcrylic: 'Acrylic (Windows)',
      windowEffectBlur: 'Blur (Windows)',
      windowEffectVibrancy: 'Vibrancy (macOS)',
      windowEffectRuntimeCardTitle: 'Native Window Transparency',
      windowEffectRuntimeCardDesc: 'Control native window translucency with runtime-aware options.',
      invalidTheme: 'Invalid theme',
      updates: 'Updates',
      updatesDesc: 'Configure update checks and notifications',
      checkUpdatesOnStart: 'Check on Start',
      checkUpdatesOnStartDesc: 'Automatically check for updates on start',
      autoInstallUpdates: 'Auto Install Updates',
      autoInstallUpdatesDesc: 'Automatically install updates when available',
      notifyOnUpdates: 'Notify on Updates',
      notifyOnUpdatesDesc: 'Show a notification when updates are available',
      updateSourceMode: 'Update Source',
      updateSourceModeDesc: 'Select where self-update metadata is fetched from',
      updateSourceModeOfficial: 'Official',
      updateSourceModeMirror: 'Mirror',
      updateSourceModeCustom: 'Custom',
      updateCustomEndpoints: 'Custom Endpoints',
      updateCustomEndpointsDesc: 'One endpoint per line',
      updateCustomEndpointsPlaceholder:
        'https://updates.example.com/{{target}}/{{current_version}}',
      updateCustomEndpointsHint: 'Only HTTPS endpoints are allowed.',
      updateCustomEndpointsErrorRequired:
        'At least one valid HTTPS endpoint is required for custom mode.',
      updateCustomEndpointsErrorInvalid:
        'Please provide valid HTTPS endpoint URLs (one per line).',
      updateFallbackToOfficial: 'Fallback to Official',
      updateFallbackToOfficialDesc:
        'Retry official source if selected source fails',
      tray: 'Tray',
      trayDesc: 'Configure tray behavior',
      minimizeToTray: 'Minimize to Tray',
      minimizeToTrayDesc: 'Minimize to tray instead of closing',
      startMinimized: 'Start Minimized',
      startMinimizedDesc: 'Launch minimized in tray',
      autostart: 'Autostart',
      autostartDesc: 'Run at login',
      showNotifications: 'Show Notifications',
      showNotificationsDesc: 'Show tray notifications',
      trayNotificationLevel: 'Tray Notification Level',
      trayNotificationLevelDesc: 'Notification level for tray',
      trayNotificationLevelAll: 'All',
      trayNotificationLevelImportantOnly: 'Important Only',
      trayNotificationLevelNone: 'None',
      trayClickBehavior: 'Tray Click Behavior',
      trayClickBehaviorDesc: 'Action when tray icon is clicked',
      trayClickToggle: 'Toggle Window',
      trayClickMenu: 'Show Menu',
      trayClickCheckUpdates: 'Check Updates',
      trayClickNothing: 'Do Nothing',
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
      shortcuts: 'Keyboard Shortcuts',
      shortcutsDesc: 'Configure global keyboard shortcuts that work system-wide',
      shortcutsEnabled: 'Enable Global Shortcuts',
      shortcutsEnabledDesc: 'Register system-wide shortcuts',
      shortcutsToggleWindow: 'Toggle Window',
      shortcutsToggleWindowDesc: 'Show or hide the main window',
      shortcutsCommandPalette: 'Command Palette',
      shortcutsCommandPaletteDesc: 'Open the command palette from anywhere',
      shortcutsQuickSearch: 'Quick Search',
      shortcutsQuickSearchDesc: 'Open package search from anywhere',
      shortcutsRecording: 'Press keys...',
      shortcutsReset: 'Reset to Default',
      shortcutsDesktopOnly: 'Global shortcuts are only available in the desktop app',
      onboardingTitle: 'Onboarding & Tour',
      onboardingDesc: 'Manage setup progress and guided tour entry points.',
      onboardingRerun: 'Re-run Setup Wizard',
      onboardingResume: 'Continue Setup',
      onboardingStartTour: 'Start Guided Tour',
      onboardingResetSuccess: 'Setup wizard restarted.',
      onboardingResumeSuccess: 'Resumed setup from your last step.',
      onboardingTourStarted: 'Guided tour started.',
      onboardingStatusCompleted: 'Setup completed',
      onboardingStatusSkipped: 'Setup was skipped',
      onboardingStatusPaused: 'Setup paused',
      onboardingStatusResumable: 'Can resume',
      onboardingTourDone: 'Guided tour completed',
      onboardingModeQuick: 'Quick mode',
      onboardingModeDetailed: 'Detailed mode',
      onboardingRerunModeHint:
        'Re-running onboarding now starts from mode selection so you can switch between quick and detailed setup.',
      sidebarOrderTitle: 'Sidebar Content Order',
      sidebarOrderDesc: 'Customize the order of top-level sidebar entries.',
      sidebarOrderReset: 'Reset Order',
      sidebarOrderResetSuccess: 'Sidebar order has been reset to defaults.',
      sidebarOrderMoveUp: 'Move up',
      sidebarOrderMoveDown: 'Move down',
      hintsTitle: 'Bubble Hints',
      hintsDesc: 'Show contextual tips on pages you visit for the first time.',
      hintsReset: 'Reset Hints',
      hintsResetSuccess: 'All bubble hints have been reset and will appear again.',
      hintsDismissAll: 'Dismiss All',
      hintsDismissAllSuccess: 'All bubble hints have been dismissed.',
      hintsDismissedCount: '{count} hint(s) dismissed',
      nav: {
        label: 'Settings navigation',
        title: 'Section Navigation',
        hasChanges: 'Has unsaved changes',
        collapsed: 'Collapsed',
        hint: 'Keyboard shortcuts',
        hintSearch: 'Focus search',
        hintNavigate: 'Navigate sections',
      },
      startup: 'Startup',
      startupDesc: 'Startup checks and scans',
      startupScanEnvironments: 'Scan Environments on Startup',
      startupScanEnvironmentsDesc: 'Scan environments at startup',
      startupScanPackages: 'Scan Packages on Startup',
      startupScanPackagesDesc: 'Scan packages at startup',
      startupMaxConcurrentScans: 'Max Concurrent Scans',
      startupMaxConcurrentScansDesc: 'Maximum startup scans',
      startupTimeoutSecs: 'Startup Timeout (sec)',
      startupTimeoutSecsDesc: 'Timeout for startup scan process',
      startupIntegrityCheck: 'Startup Integrity Check',
      startupIntegrityCheckDesc: 'Validate startup state',
      backupAutoBackupEnabled: 'Auto Backup Enabled',
      backupAutoBackupEnabledDesc: 'Enable scheduled backups',
      backupAutoBackupIntervalHours: 'Backup Interval (Hours)',
      backupAutoBackupIntervalHoursDesc: 'How often to create backups',
      backupMaxBackups: 'Max Backups',
      backupMaxBackupsDesc: 'Maximum number of backups to keep',
      backupRetentionDays: 'Retention Days',
      backupRetentionDaysDesc: 'How many days backups are kept',
      section: {
        modified: 'Modified',
        moreActions: 'More actions',
        resetToDefaults: 'Reset to defaults',
      },
    },
    backup: {
      title: 'Backup',
      description: 'Backup policy and operations',
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

function setupMocks(
  overrides?: Partial<{
    config: Record<string, string>;
    appSettings: AppSettings;
    loading: boolean;
    appearance: Record<string, unknown>;
  }>,
) {
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
    updateSourceMode: 'official',
    updateCustomEndpoints: [],
    updateFallbackToOfficial: true,
    minimizeToTray: true,
    startMinimized: false,
    autostart: false,
    trayClickBehavior: 'toggle_window',
    showNotifications: true,
    trayNotificationLevel: 'all',
    sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
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
    cogniaDir: '/home/user/.cognia',
  });

  useAppearanceStore.mockReturnValue({
    accentColor: 'blue',
    setAccentColor: mockSetAccentColor,
    chartColorTheme: 'default',
    setChartColorTheme: mockSetChartColorTheme,
    interfaceRadius: 0.625,
    setInterfaceRadius: mockSetInterfaceRadius,
    interfaceDensity: 'comfortable',
    setInterfaceDensity: mockSetInterfaceDensity,
    reducedMotion: false,
    setReducedMotion: mockSetReducedMotion,
    backgroundEnabled: false,
    backgroundOpacity: 20,
    backgroundBlur: 0,
    backgroundFit: 'cover',
    backgroundScale: 100,
    setBackgroundScale: jest.fn(),
    backgroundPositionX: 50,
    setBackgroundPositionX: jest.fn(),
    backgroundPositionY: 50,
    setBackgroundPositionY: jest.fn(),
    resetBackgroundTuning: jest.fn(),
    windowEffect: 'auto',
    setWindowEffect: mockSetWindowEffect,
    presets: [
      {
        id: 'default',
        name: 'Default',
        config: {
          theme: 'light',
          accentColor: 'blue',
          chartColorTheme: 'default',
          interfaceRadius: 0.625,
          interfaceDensity: 'comfortable',
          reducedMotion: false,
          backgroundEnabled: false,
          backgroundOpacity: 20,
          backgroundBlur: 0,
          backgroundFit: 'cover',
          backgroundScale: 100,
          backgroundPositionX: 50,
          backgroundPositionY: 50,
          windowEffect: 'auto',
        },
      },
    ],
    activePresetId: 'default',
    createPreset: mockCreatePreset.mockReturnValue('preset-1'),
    renamePreset: mockRenamePreset,
    deletePreset: mockDeletePreset,
    setActivePresetId: mockSetActivePresetId,
    applyPreset: mockApplyPreset.mockImplementation(() => ({
      theme: 'light',
      accentColor: 'blue',
      chartColorTheme: 'default',
      interfaceRadius: 0.625,
      interfaceDensity: 'comfortable',
      reducedMotion: false,
      backgroundEnabled: false,
      backgroundOpacity: 20,
      backgroundBlur: 0,
      backgroundFit: 'cover',
      backgroundScale: 100,
      backgroundPositionX: 50,
      backgroundPositionY: 50,
      windowEffect: 'auto',
    })),
    replacePresetCollection: mockReplacePresetCollection,
    reset: mockResetAppearance,
    ...overrides?.appearance,
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
    mockConfigExport.mockResolvedValue('backend-config');
    mockConfigImport.mockResolvedValue(undefined);
    mockWindowEffectApply.mockResolvedValue(undefined);
    mockWindowEffectGetSupported.mockResolvedValue(['auto', 'none', 'mica']);
    setupMocks();
    useOnboardingStore.setState({
      mode: null,
      completed: false,
      skipped: false,
      currentStep: 0,
      visitedSteps: [],
      wizardOpen: false,
      tourCompleted: false,
      tourActive: false,
      tourStep: 0,
      sessionState: 'idle',
      lastActiveStepId: null,
      lastActiveAt: null,
      canResume: false,
      sessionSummary: {
        mode: null,
        locale: null,
        theme: null,
        mirrorPreset: 'default',
        detectedCount: 0,
        primaryEnvironment: null,
        manageableEnvironments: [],
        shellType: null,
        shellConfigured: null,
      },
      dismissedHints: [],
      hintsEnabled: true,
    });
    mockUpdateConfigValue.mockResolvedValue(undefined);
    mockResetConfig.mockResolvedValue(undefined);
    mockFetchConfig.mockResolvedValue(baseConfig);
    mockFetchPlatformInfo.mockResolvedValue({ os: 'Windows', arch: 'x64' });
    mockSetAppSettings.mockClear();
    mockCreatePreset.mockClear();
    mockRenamePreset.mockClear();
    mockDeletePreset.mockClear();
    mockSetActivePresetId.mockClear();
    mockApplyPreset.mockClear();
    mockReplacePresetCollection.mockClear();

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
      expect(screen.getAllByText('General').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText('Network').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Appearance').length).toBeGreaterThanOrEqual(1);
  });

  it('opens mobile section navigation sheet and renders section actions', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Parallel Downloads')).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole('button', { name: /section navigation|settings\.nav\.title/i }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('navigation', { name: /settings navigation/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /General/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /Network/i }),
    ).toBeInTheDocument();
  });

  it('renders the appearance customization workbench', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Customization Workbench')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /apply preset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset appearance group/i })).toBeInTheDocument();
  });

  it('does not show preset divergence badge when current appearance matches selected preset', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Customization Workbench')).toBeInTheDocument();
    });

    expect(screen.queryByText('Differs from preset')).not.toBeInTheDocument();
  });

  it('shows preset divergence badge when current appearance differs from selected preset', async () => {
    const { useTheme } = jest.requireMock('next-themes') as {
      useTheme: jest.Mock;
    };

    useTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Customization Workbench')).toBeInTheDocument();
    });

    expect(screen.getByText('Differs from preset')).toBeInTheDocument();
  });

  it('shows preset divergence badge when only advanced background fields differ', async () => {
    setupMocks({
      appearance: {
        backgroundScale: 135,
      },
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Customization Workbench')).toBeInTheDocument();
    });

    expect(screen.getByText('Differs from preset')).toBeInTheDocument();
  });

  it('applies selected appearance preset from workbench', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /apply preset/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /apply preset/i }));

    expect(mockApplyPreset).toHaveBeenCalledWith('default');
  });

  it('resets only appearance group from workbench', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset appearance group/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /reset appearance group/i }));

    expect(mockResetAppearance).toHaveBeenCalled();
    expect(mockReplacePresetCollection).toHaveBeenCalled();
  });

  it('saves changed config values', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Parallel Downloads')).toBeInTheDocument();
    });

    const parallelDownloads = screen.getByLabelText('Parallel Downloads');
    fireEvent.change(parallelDownloads, { target: { value: '6' } });

    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateConfigValue).toHaveBeenCalledWith('general.parallel_downloads', '6');
    });
  });

  it('shows conflict alert when baseline refresh happens during local draft edits', async () => {
    const { rerender } = renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Parallel Downloads')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Parallel Downloads'), {
      target: { value: '9' },
    });

    setupMocks({
      config: {
        ...baseConfig,
        'network.timeout': '45',
      },
    });
    rerender(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Detected baseline refresh while you had local drafts'),
      ).toBeInTheDocument();
    });
  });

  it('retries failed save items only after partial save failure', async () => {
    let failOnce = true;
    mockUpdateConfigValue.mockImplementation(async (key: string) => {
      if (key === 'network.timeout' && failOnce) {
        failOnce = false;
        throw new Error('network timeout save failed');
      }
      return undefined;
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Parallel Downloads')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Parallel Downloads'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByLabelText('Timeout'), {
      target: { value: '20' },
    });

    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry failed items/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /retry failed items/i }));

    await waitFor(() => {
      const timeoutCalls = mockUpdateConfigValue.mock.calls.filter(
        ([key]) => key === 'network.timeout',
      );
      expect(timeoutCalls.length).toBe(2);
    });

    const parallelCalls = mockUpdateConfigValue.mock.calls.filter(
      ([key]) => key === 'general.parallel_downloads',
    );
    expect(parallelCalls.length).toBe(1);
  });

  it('exports settings payload', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    // Open the export dropdown, then click "Export as File"
    await userEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => {
      expect(screen.getByText('Export as File')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Export as File'));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Settings exported successfully');
  });

  it('copies exported settings to clipboard', async () => {
    const clipboardMock = jest.requireMock('@/lib/clipboard');
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => {
      expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Copy to Clipboard'));

    await waitFor(() => {
      expect(clipboardMock.writeClipboard).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith('Copy to Clipboard');
  });

  it('imports settings with preview confirmation and updates app settings', async () => {
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
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /apply import/i }));

    await waitFor(() => {
      expect(mockSetAppSettings).toHaveBeenCalledWith({ checkUpdatesOnStart: false });
    });
    expect(toast.success).toHaveBeenCalledWith('Settings imported successfully');
  });

  it('imports settings from clipboard and allows preview cancellation', async () => {
    const clipboardMock = jest.requireMock('@/lib/clipboard');
    clipboardMock.readClipboard.mockResolvedValueOnce(
      JSON.stringify({
        settings: {
          'network.timeout': '20',
        },
      }),
    );

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /import/i }));
    await waitFor(() => {
      expect(screen.getByText('Import from Clipboard')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Import from Clipboard'));

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('shows an invalid format toast when clipboard payload cannot be parsed', async () => {
    const clipboardMock = jest.requireMock('@/lib/clipboard');
    clipboardMock.readClipboard.mockResolvedValueOnce('{invalid-json');

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /import/i }));
    await waitFor(() => {
      expect(screen.getByText('Import from Clipboard')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Import from Clipboard'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid JSON payload');
    });
  });

  it('persists config-backed update app settings through config writes', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /check on start/i })).toBeInTheDocument();
    });

    const updateToggle = screen.getByRole('switch', { name: /check on start/i });
    await userEvent.click(updateToggle);

    expect(mockSetAppSettings).toHaveBeenCalledWith({ checkUpdatesOnStart: false });
    await waitFor(() => {
      expect(mockUpdateConfigValue).toHaveBeenCalledWith('updates.check_on_start', 'false');
    });
  });

  it('persists update source mode through config writes', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /update source/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('combobox', { name: /update source/i }));
    await userEvent.click(screen.getByRole('option', { name: /mirror/i }));

    expect(mockSetAppSettings).toHaveBeenCalledWith({ updateSourceMode: 'mirror' });
    await waitFor(() => {
      expect(mockUpdateConfigValue).toHaveBeenCalledWith('updates.source_mode', 'mirror');
    });
  });

  it('keeps minimize-to-tray on dedicated runtime path without duplicate config write', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /minimize to tray/i })).toBeInTheDocument();
    });

    const minimizeToggle = screen.getByRole('switch', { name: /minimize to tray/i });
    await userEvent.click(minimizeToggle);

    expect(mockSetAppSettings).toHaveBeenCalledWith({ minimizeToTray: false });
    expect(mockUpdateConfigValue).not.toHaveBeenCalledWith('tray.minimize_to_tray', 'false');
  });

  it('renders backup policy controls and reset actions for backup/startup sections', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(document.getElementById('section-backup')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Auto Backup Enabled')).toBeInTheDocument();

    const backupSection = document.getElementById('section-backup');
    const startupSection = document.getElementById('section-startup');

    expect(backupSection).toBeTruthy();
    expect(startupSection).toBeTruthy();

    const moreActionsLabel = /more actions|settings\.section\.moreActions/i;
    expect(within(backupSection as HTMLElement).getByLabelText(moreActionsLabel)).toBeInTheDocument();
    expect(within(startupSection as HTMLElement).getByLabelText(moreActionsLabel)).toBeInTheDocument();
  });

  it('resets settings through the confirmation dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('General').length).toBeGreaterThanOrEqual(1);
    });

    const resetButton = screen.getAllByRole('button', { name: /reset/i })[0];
    await user.click(resetButton);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('alertdialog');
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
      expect(screen.getByLabelText('Parallel Downloads')).toBeInTheDocument();
    });

    const parallelDownloads = screen.getByLabelText('Parallel Downloads');
    fireEvent.change(parallelDownloads, { target: { value: '7' } });

    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

    // Discard changes via Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
    });
    expect((parallelDownloads as HTMLInputElement).value).toBe('4');

    // Now test Ctrl+S save
    fireEvent.change(parallelDownloads, { target: { value: '7' } });
    fireEvent.keyDown(document, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(mockUpdateConfigValue).toHaveBeenCalledWith('general.parallel_downloads', '7');
    });
  });

  it('does not reset via Ctrl+R when focused on an input', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Parallel Downloads')).toBeInTheDocument();
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

    // When loading=true, Ctrl+S should not trigger save
    fireEvent.keyDown(document, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(mockUpdateConfigValue).not.toHaveBeenCalled();
    });
  });

  it('renders import dropdown with file and clipboard options', async () => {
    setupMocks();
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    // The Import button should be a dropdown trigger
    const importBtn = screen.getByRole('button', { name: /Import/i });
    expect(importBtn).toBeInTheDocument();

    await userEvent.click(importBtn);
    await waitFor(() => {
      expect(screen.getByText('Import from File')).toBeInTheDocument();
      expect(screen.getByText('Import from Clipboard')).toBeInTheDocument();
    });
  });

  it('renders export dropdown with file and clipboard options', async () => {
    setupMocks();
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Export/i });
    expect(exportBtn).toBeInTheDocument();

    await userEvent.click(exportBtn);
    await waitFor(() => {
      expect(screen.getByText('Export as File')).toBeInTheDocument();
      expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
    });
  });

  it('shows error toast when importing from empty clipboard', async () => {
    setupMocks();
    const clipboardMock = jest.requireMock('@/lib/clipboard');
    clipboardMock.readClipboard.mockResolvedValueOnce('');

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /Import/i });
    await userEvent.click(importBtn);
    await waitFor(() => {
      expect(screen.getByText('Import from Clipboard')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Import from Clipboard'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Clipboard is empty');
    });
  });

  it('shows resume but not start-tour when onboarding is paused and resumable', async () => {
    useOnboardingStore.setState({
      mode: 'quick',
      sessionState: 'paused',
      canResume: true,
      completed: false,
      skipped: false,
      tourCompleted: false,
    });

    renderWithProviders(<SettingsPage />);

    expect(await screen.findByRole('button', { name: 'Continue Setup' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Guided Tour' })).not.toBeInTheDocument();
  });

  it('runs onboarding resume and rerun actions from the onboarding card', async () => {
    useOnboardingStore.setState({
      mode: 'quick',
      sessionState: 'paused',
      canResume: true,
      completed: false,
      skipped: false,
      tourCompleted: false,
    });

    renderWithProviders(<SettingsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Continue Setup' }));
    await userEvent.click(screen.getByRole('button', { name: 'Re-run Setup Wizard' }));

    expect(toast.info).toHaveBeenCalledWith('Resumed setup from your last step.');
    expect(toast.success).toHaveBeenCalledWith('Setup wizard restarted.');
  });

  it('shows start-tour but not resume when onboarding was skipped', async () => {
    useOnboardingStore.setState({
      mode: 'quick',
      sessionState: 'skipped',
      canResume: false,
      completed: false,
      skipped: true,
      tourCompleted: false,
      dismissedHints: ['terminal-config-editor'],
      hintsEnabled: true,
    });

    renderWithProviders(<SettingsPage />);

    expect(await screen.findByRole('button', { name: 'Start Guided Tour' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue Setup' })).not.toBeInTheDocument();
  });

  it('runs onboarding hint actions and start-tour action', async () => {
    useOnboardingStore.setState({
      mode: 'quick',
      sessionState: 'skipped',
      canResume: false,
      completed: false,
      skipped: true,
      tourCompleted: false,
      dismissedHints: ['terminal-config-editor'],
      hintsEnabled: true,
    });

    renderWithProviders(<SettingsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Start Guided Tour' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset Hints' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss All' }));

    expect(toast.info).toHaveBeenCalledWith('Guided tour started.');
    expect(toast.success).toHaveBeenCalledWith('All bubble hints have been reset and will appear again.');
    expect(toast.success).toHaveBeenCalledWith('All bubble hints have been dismissed.');
  });

  it('updates and resets sidebar order from the settings page', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sidebar Content Order')).toBeInTheDocument();
    });

    mockSetAppSettings.mockClear();

    const moveDownButtons = screen.getAllByRole('button', { name: 'Move down' });
    await userEvent.click(moveDownButtons[0]);
    expect(mockSetAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        sidebarItemOrder: expect.any(Array),
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reset Order' }));
    expect(toast.success).toHaveBeenCalledWith('Sidebar order has been reset to defaults.');
  });
});

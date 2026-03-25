import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnvVarPage from './page';

const mockLoadDetection = jest.fn().mockResolvedValue(null);
const mockSetVar = jest.fn().mockResolvedValue(true);
const mockRemoveVar = jest.fn().mockResolvedValue(true);
const mockFetchPath = jest.fn().mockResolvedValue([]);
const mockAddPathEntry = jest.fn().mockResolvedValue(true);
const mockRemovePathEntry = jest.fn().mockResolvedValue(true);
const mockReorderPath = jest.fn().mockResolvedValue(true);
const mockFetchShellProfiles = jest.fn().mockResolvedValue([]);
const mockReadShellProfile = jest.fn().mockResolvedValue('');
const mockPreviewImportEnvFile = jest.fn().mockResolvedValue(null);
const mockApplyImportPreview = jest.fn().mockResolvedValue(null);
const mockImportEnvFile = jest.fn().mockResolvedValue(null);
const mockExportEnvFile = jest.fn().mockResolvedValue(null);
const mockDeduplicatePath = jest.fn().mockResolvedValue(0);
const mockPreviewPathRepair = jest.fn().mockResolvedValue(null);
const mockApplyPathRepair = jest.fn().mockResolvedValue(null);
const mockResolveConflict = jest.fn().mockResolvedValue(null);
const mockRevealVar = jest.fn().mockResolvedValue(null);
const mockFetchSnapshotHistory = jest.fn().mockResolvedValue([]);
const mockCreateSnapshot = jest.fn().mockResolvedValue(null);
const mockGetBackupProtection = jest.fn().mockResolvedValue(null);
const mockPreviewSnapshotRestore = jest.fn().mockResolvedValue(null);
const mockRestoreSnapshot = jest.fn().mockResolvedValue(null);
const mockDeleteSnapshot = jest.fn().mockResolvedValue(true);
let mockIsTauri = false;

const hookState = {
  envVars: {} as Record<string, string>,
  processVarSummaries: [] as Array<{ key: string; scope: string; value: { displayValue: string; masked: boolean; hasValue: boolean; length: number; isSensitive: boolean; sensitivityReason?: string | null } }>,
  userPersistentVarsTyped: [] as Array<{ key: string; value: string; regType?: string }>,
  systemPersistentVarsTyped: [] as Array<{ key: string; value: string; regType?: string }>,
  userPersistentVarSummaries: [] as Array<{ key: string; scope: string; regType?: string; value: { displayValue: string; masked: boolean; hasValue: boolean; length: number; isSensitive: boolean; sensitivityReason?: string | null } }>,
  systemPersistentVarSummaries: [] as Array<{ key: string; scope: string; regType?: string; value: { displayValue: string; masked: boolean; hasValue: boolean; length: number; isSensitive: boolean; sensitivityReason?: string | null } }>,
  revealedValues: {} as Record<string, string>,
  pathEntries: [] as never[],
  shellProfiles: [] as never[],
  conflicts: [] as Array<{ key: string; userValue: string; systemValue: string; effectiveValue: string }>,
  importPreview: null as null | { fingerprint: string },
  importPreviewStale: false,
  pathRepairPreview: null as null | { fingerprint: string },
  pathRepairPreviewStale: false,
  shellGuidance: [] as Array<{ shell: string; configPath: string; command: string; autoApplied: boolean }>,
  loading: false,
  detectionLoading: false,
  pathLoading: false,
  importExportLoading: false,
  error: null as string | null,
  detectionState: 'idle' as 'idle' | 'loading-no-cache' | 'showing-cache-refreshing' | 'showing-fresh' | 'empty' | 'error',
  detectionFromCache: false,
  detectionError: null as string | null,
  detectionCanRetry: false,
  supportSnapshot: null as null | {
    state: string;
    reasonCode: string;
    reason: string;
    platform: string;
    detectedShells: number;
    primaryShellTarget?: string | null;
    actions: Array<{
      action: string;
      scope?: string | null;
      supported: boolean;
      state: string;
      reasonCode: string;
      reason: string;
      nextSteps: string[];
    }>;
  },
  supportLoading: false,
  supportError: null as string | null,
  snapshotHistory: [] as Array<{
    path: string;
    name: string;
    createdAt: string;
    creationMode: string;
    sourceAction?: string | null;
    note?: string | null;
    scopes: string[];
    integrityState: string;
  }>,
  snapshotLoading: false,
  snapshotError: null as string | null,
  fetchSnapshotHistory: mockFetchSnapshotHistory,
  createSnapshot: mockCreateSnapshot,
  getBackupProtection: mockGetBackupProtection,
  previewSnapshotRestore: mockPreviewSnapshotRestore,
  restoreSnapshot: mockRestoreSnapshot,
  deleteSnapshot: mockDeleteSnapshot,
  loadSupportSnapshot: jest.fn(),
  setVar: mockSetVar,
  removeVar: mockRemoveVar,
  fetchPath: mockFetchPath,
  addPathEntry: mockAddPathEntry,
  removePathEntry: mockRemovePathEntry,
  reorderPath: mockReorderPath,
  fetchShellProfiles: mockFetchShellProfiles,
  readShellProfile: mockReadShellProfile,
  previewImportEnvFile: mockPreviewImportEnvFile,
  applyImportPreview: mockApplyImportPreview,
  clearImportPreview: jest.fn(),
  importEnvFile: mockImportEnvFile,
  exportEnvFile: mockExportEnvFile,
  deduplicatePath: mockDeduplicatePath,
  previewPathRepair: mockPreviewPathRepair,
  applyPathRepair: mockApplyPathRepair,
  clearPathRepairPreview: jest.fn(),
  resolveConflict: mockResolveConflict,
  revealVar: mockRevealVar,
  loadDetection: mockLoadDetection,
};

jest.mock('@/hooks/use-envvar', () => ({
  useEnvVar: () => hookState,
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'en', setLocale: jest.fn() }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

describe('EnvVarPage', () => {
  const originalInnerWidth = window.innerWidth;
  const makeSummary = (
    key: string,
    displayValue: string,
    scope: 'process' | 'user' | 'system',
  ) => ({
    key,
    scope,
    value: {
      displayValue,
      masked: false,
      hasValue: true,
      length: displayValue.length,
      isSensitive: false,
      sensitivityReason: null,
    },
  });

  beforeEach(() => {
    mockIsTauri = false;
    hookState.envVars = {};
    hookState.processVarSummaries = [];
    hookState.userPersistentVarsTyped = [];
    hookState.systemPersistentVarsTyped = [];
    hookState.userPersistentVarSummaries = [];
    hookState.systemPersistentVarSummaries = [];
    hookState.revealedValues = {};
    hookState.pathEntries = [];
    hookState.shellProfiles = [];
    hookState.conflicts = [];
    hookState.importPreview = null;
    hookState.importPreviewStale = false;
    hookState.pathRepairPreview = null;
    hookState.pathRepairPreviewStale = false;
    hookState.shellGuidance = [];
    hookState.loading = false;
    hookState.detectionLoading = false;
    hookState.pathLoading = false;
    hookState.importExportLoading = false;
    hookState.error = null;
    hookState.detectionState = 'idle';
    hookState.detectionFromCache = false;
    hookState.detectionError = null;
    hookState.detectionCanRetry = false;
    hookState.supportSnapshot = null;
    hookState.supportLoading = false;
    hookState.supportError = null;
    hookState.snapshotHistory = [];
    hookState.snapshotLoading = false;
    hookState.snapshotError = null;
    mockSetVar.mockResolvedValue(true);
    mockLoadDetection.mockResolvedValue(null);
    mockGetBackupProtection.mockResolvedValue(null);
    mockPreviewSnapshotRestore.mockResolvedValue(null);
    mockRestoreSnapshot.mockResolvedValue(null);
    mockDeleteSnapshot.mockResolvedValue(true);
    jest.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  afterAll(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
  });

  it('should render desktop-required empty state in web mode', () => {
    render(<EnvVarPage />);
    expect(screen.getByText('envvar.emptyState.title')).toBeInTheDocument();
    expect(screen.getByText('envvar.emptyState.description')).toBeInTheDocument();
  });

  it('should render page header', () => {
    render(<EnvVarPage />);
    expect(screen.getByText('envvar.title')).toBeInTheDocument();
  });

  it('auto-loads detection on desktop init', async () => {
    mockIsTauri = true;
    render(<EnvVarPage />);

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalledWith('all', { forceRefresh: true });
    });
  });

  it('renders one-row desktop action layout', async () => {
    mockIsTauri = true;
    render(<EnvVarPage />);

    const actions = screen.getByTestId('envvar-header-actions');
    expect(actions).toBeInTheDocument();
    expect(actions.className).toContain('md:flex-nowrap');
    expect(screen.getByRole('button', { name: 'envvar.importExport.import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'envvar.importExport.export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'envvar.actions.refresh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'envvar.actions.add' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalled();
    });
  });

  it('renders snapshot history and manual snapshot entry point on desktop', async () => {
    mockIsTauri = true;
    hookState.snapshotHistory = [
      {
        path: 'D:/snapshots/envvar-snapshot-1',
        name: 'envvar-snapshot-1',
        createdAt: '2026-03-19T00:00:00Z',
        creationMode: 'manual',
        sourceAction: 'import_apply',
        note: 'before import',
        scopes: ['user', 'system'],
        integrityState: 'valid',
      },
    ];

    render(<EnvVarPage />);

    expect(screen.getByTestId('envvar-snapshot-history')).toBeInTheDocument();
    expect(screen.getByText('envvar-snapshot-1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'envvar.snapshots.create' }));
    expect(mockCreateSnapshot).toHaveBeenCalled();
  });

  it('renders backup protection summary for risky envvar workflows', async () => {
    mockIsTauri = true;
    mockGetBackupProtection.mockResolvedValueOnce({
      action: 'import_apply',
      scope: 'user',
      state: 'will_create',
      reasonCode: 'new_snapshot_required',
      reason: 'A fresh envvar safety snapshot should be created before this mutation runs.',
      nextSteps: [],
      snapshot: null,
    });

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-snapshot-protection')).toBeInTheDocument();
    });
    expect(screen.getByText('A fresh envvar safety snapshot should be created before this mutation runs.')).toBeInTheDocument();
  });

  it('shows restore preview details for a selected snapshot', async () => {
    mockIsTauri = true;
    hookState.snapshotHistory = [
      {
        path: 'D:/snapshots/envvar-snapshot-1',
        name: 'envvar-snapshot-1',
        createdAt: '2026-03-19T00:00:00Z',
        creationMode: 'manual',
        sourceAction: 'import_apply',
        note: 'before import',
        scopes: ['user', 'system'],
        integrityState: 'valid',
      },
    ];
    mockPreviewSnapshotRestore.mockResolvedValueOnce({
      createdAt: '2026-03-19T00:00:00Z',
      segments: [
        {
          scope: 'user',
          changedVariables: 2,
          addedVariables: 1,
          removedVariables: 0,
          addedPathEntries: 1,
          removedPathEntries: 0,
          skipped: false,
          reasonCode: null,
          reason: null,
        },
      ],
    });

    render(<EnvVarPage />);

    await userEvent.click(screen.getByRole('button', { name: 'envvar.snapshots.preview' }));

    await waitFor(() => {
      expect(screen.getByTestId('envvar-snapshot-preview')).toBeInTheDocument();
    });
    expect(screen.getByText(/envvar\.snapshots\.segmentSummary/)).toBeInTheDocument();
    expect(mockPreviewSnapshotRestore).toHaveBeenCalledWith('D:/snapshots/envvar-snapshot-1');
  });

  it('disables refresh when backend support marks it blocked', async () => {
    mockIsTauri = true;
    hookState.supportSnapshot = {
      state: 'degraded',
      reasonCode: 'desktop_runtime_unavailable',
      reason: 'Refresh is currently unavailable.',
      platform: 'linux',
      detectedShells: 1,
      primaryShellTarget: '/home/user/.bashrc',
      actions: [
        {
          action: 'refresh',
          scope: 'all',
          supported: false,
          state: 'blocked',
          reasonCode: 'desktop_runtime_unavailable',
          reason: 'Refresh is currently unavailable.',
          nextSteps: ['Start the desktop runtime.'],
        },
      ],
    };

    render(<EnvVarPage />);

    expect(screen.getByRole('button', { name: 'envvar.actions.refresh' })).toBeDisabled();
  });

  it('keeps variables/path/shell tab content available with stable shells', async () => {
    mockIsTauri = true;
    hookState.pathEntries = [
      { path: '/usr/bin', exists: true, isDirectory: true, isDuplicate: false },
    ] as never[];
    hookState.shellProfiles = [
      { shell: 'bash', configPath: '/home/user/.bashrc', exists: true, isCurrent: true },
    ] as never[];
    hookState.detectionState = 'showing-fresh';
    mockReadShellProfile.mockResolvedValue('export PATH=/usr/bin');

    render(<EnvVarPage />);

    expect(screen.getByTestId('envvar-variables-content')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('tab', { name: /^envvar\.tabs\.pathEditor(?:\s+\d+)?$/ }),
    );
    expect(screen.getByTestId('envvar-path-content')).toBeInTheDocument();
    expect(screen.getByTestId('envvar-path-editor')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('tab', { name: /^envvar\.tabs\.shellProfiles(?:\s+\d+)?$/ }),
    );
    expect(screen.getByTestId('envvar-shells-content')).toBeInTheDocument();
    expect(screen.getByTestId('envvar-shell-profiles-panel')).toBeInTheDocument();
  });

  it('renders compact conflict summary on narrow viewport', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      {
        key: 'JAVA_HOME',
        userValue: '/home/bin',
        systemValue: '/usr/bin',
        effectiveValue: '/home/bin',
      },
    ];
    hookState.detectionState = 'showing-fresh';
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 640 });

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-compact-list')).toBeInTheDocument();
    });
  });

  it('renders desktop conflict summary with effective value emphasis and stable ordering', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      {
        key: 'PATH',
        userValue: '/user/bin',
        systemValue: '/system/bin',
        effectiveValue: '/user/bin',
      },
      {
        key: 'JAVA_HOME',
        userValue: 'C:\\jdk-21',
        systemValue: 'C:\\jdk-17',
        effectiveValue: 'C:\\jdk-21',
      },
    ];
    hookState.detectionState = 'showing-fresh';
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-table')).toBeInTheDocument();
    });

    const table = screen.getByTestId('envvar-conflicts-table');
    const effectiveValues = within(table).getAllByTestId('envvar-conflict-effective-value');
    expect(effectiveValues).toHaveLength(1);
    expect(effectiveValues[0]).toHaveTextContent('C:\\jdk-21');
    expect(within(table).queryByText('PATH')).not.toBeInTheDocument();
  });

  it('ignores PATHEXT by default', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      { key: 'PATHEXT', userValue: '.EXE', systemValue: '.EXE;.BAT', effectiveValue: '.EXE;.BAT' },
      { key: 'JAVA_HOME', userValue: 'A', systemValue: 'B', effectiveValue: 'A' },
    ];
    hookState.detectionState = 'showing-fresh';

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-table')).toBeInTheDocument();
    });

    const table = screen.getByTestId('envvar-conflicts-table');
    expect(within(table).queryByText('PATHEXT')).not.toBeInTheDocument();
    expect(within(table).getByText('JAVA_HOME')).toBeInTheDocument();
  });

  it('bounds conflict summary height so variable list remains available', async () => {
    mockIsTauri = true;
    hookState.conflicts = Array.from({ length: 40 }, (_, index) => ({
      key: `KEY_${index}`,
      userValue: `user_${index}`,
      systemValue: `system_${index}`,
      effectiveValue: `effective_${index}`,
    }));
    hookState.detectionState = 'showing-fresh';

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-scroll-area')).toBeInTheDocument();
    });

    const conflictsArea = screen.getByTestId('envvar-conflicts-scroll-area');
    expect(conflictsArea.className).toContain('max-h-[32vh]');
    expect(conflictsArea.className).toContain('overflow-y-auto');
    expect(screen.getByTestId('envvar-variables-list-shell')).toBeInTheDocument();
  });

  it('supports collapsing, dismissing, and restoring conflict panel', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      { key: 'JAVA_HOME', userValue: 'A', systemValue: 'B', effectiveValue: 'A' },
    ];
    hookState.detectionState = 'showing-fresh';

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-summary')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('envvar-conflicts-toggle'));
    expect(screen.queryByTestId('envvar-conflicts-scroll-area')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('envvar-conflicts-dismiss'));
    expect(screen.queryByTestId('envvar-conflicts-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('envvar-conflicts-restore')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('envvar-conflicts-restore'));
    expect(screen.getByTestId('envvar-conflicts-summary')).toBeInTheDocument();
  });

  it('allows adding custom ignored conflict key', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      { key: 'JAVA_HOME', userValue: 'A', systemValue: 'B', effectiveValue: 'A' },
    ];
    hookState.detectionState = 'showing-fresh';

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-scroll-area')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByTestId('envvar-conflicts-ignore-input'), 'JAVA_HOME');
    await userEvent.click(screen.getByTestId('envvar-conflicts-ignore-add'));

    await waitFor(() => {
      expect(screen.queryByTestId('envvar-conflicts-scroll-area')).not.toBeInTheDocument();
      expect(screen.getByText('envvar.conflicts.noConflicts')).toBeInTheDocument();
    });
  });

  it('supports batch adding ignored keys and clearing custom rules', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      { key: 'JAVA_HOME', userValue: 'A', systemValue: 'B', effectiveValue: 'A' },
      { key: 'GOPATH', userValue: 'C', systemValue: 'D', effectiveValue: 'C' },
    ];
    hookState.detectionState = 'showing-fresh';

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-scroll-area')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByTestId('envvar-conflicts-ignore-input'), 'JAVA_HOME, GOPATH');
    await userEvent.click(screen.getByTestId('envvar-conflicts-ignore-add'));

    await waitFor(() => {
      expect(screen.queryByTestId('envvar-conflicts-scroll-area')).not.toBeInTheDocument();
      expect(screen.getByText('envvar.conflicts.noConflicts')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('envvar-conflicts-ignore-clear'));

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-scroll-area')).toBeInTheDocument();
      expect(screen.getByTestId('envvar-conflicts-table')).toBeInTheDocument();
    });
  });

  it('uses bounded page/tabs/list shells for scroll containment', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    render(<EnvVarPage />);

    const pageRoot = screen.getByTestId('envvar-page-root');
    const tabsRoot = screen.getByTestId('envvar-tabs');
    const listShell = screen.getByTestId('envvar-variables-list-shell');

    expect(pageRoot.className).toContain('h-full');
    expect(pageRoot.className).toContain('min-h-0');
    expect(pageRoot.className).toContain('overflow-hidden');
    expect(tabsRoot.className).toContain('min-h-0');
    expect(tabsRoot.className).toContain('flex-1');
    expect(listShell.className).toContain('min-h-0');
    expect(listShell.className).toContain('flex-1');

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalled();
    });
  });

  it('shows cache-refreshing detection state', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-cache-refreshing';
    hookState.detectionFromCache = true;

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-detection-status')).toHaveAttribute('data-detection-state', 'showing-cache-refreshing');
      expect(screen.getByText('envvar.detection.cacheRefreshing')).toBeInTheDocument();
    });
  });

  it('shows error fallback and retries detection with force refresh', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'error';
    hookState.detectionFromCache = true;
    hookState.detectionError = 'cached refresh failed';
    hookState.detectionCanRetry = true;

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalled();
    });
    mockLoadDetection.mockClear();

    expect(screen.getByTestId('envvar-detection-error')).toHaveTextContent('cached refresh failed');

    await userEvent.click(screen.getByTestId('envvar-detection-retry'));

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalledWith('all', { forceRefresh: true });
    });
  });

  it('shows operation error state when add mutation fails', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    mockSetVar.mockResolvedValue(false);
    render(<EnvVarPage />);

    await userEvent.click(screen.getByRole('button', { name: 'envvar.actions.add' }));
    await userEvent.type(screen.getByLabelText('envvar.table.key'), 'NEW_KEY');
    await userEvent.type(screen.getByLabelText('envvar.table.value'), 'NEW_VALUE');

    const addButtons = screen.getAllByRole('button', { name: 'envvar.actions.add' });
    await userEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-operation-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('envvar-operation-error')).toHaveTextContent('envvar.actions.add');
  });

  it('resolves conflicts from conflict actions', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      { key: 'JAVA_HOME', userValue: 'A', systemValue: 'B', effectiveValue: 'A' },
    ];
    hookState.detectionState = 'showing-fresh';
    mockResolveConflict.mockResolvedValue({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      appliedValue: 'B',
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [],
    });

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-table')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('envvar-conflict-system-to-user-JAVA_HOME'));

    await waitFor(() => {
      expect(mockResolveConflict).toHaveBeenCalledWith('JAVA_HOME', 'system', 'user');
    });
  });

  it('shows manual follow-up notice for degraded conflict resolution results', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      { key: 'JAVA_HOME', userValue: 'A', systemValue: 'B', effectiveValue: 'A' },
    ];
    hookState.detectionState = 'showing-fresh';
    mockResolveConflict.mockResolvedValue({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      appliedValue: 'B',
      success: true,
      verified: false,
      status: 'manual_followup_required',
      reasonCode: 'shell_sync_required',
      message: 'Manual shell sync is still required.',
      primaryShellTarget: '/home/user/.bashrc',
      shellGuidance: [],
    });

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-table')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('envvar-conflict-system-to-user-JAVA_HOME'));

    await waitFor(() => {
      expect(screen.getByText('Manual shell sync is still required.')).toBeInTheDocument();
    });
  });

  it('shows shell guidance banner and opens shell tab from shortcut', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.shellGuidance = [
      {
        shell: 'bash',
        configPath: '/home/user/.bashrc',
        command: 'export JAVA_HOME="/jdk"',
        autoApplied: true,
      },
    ];

    render(<EnvVarPage />);

    expect(screen.getByTestId('envvar-shell-guidance-banner')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('envvar-shell-guidance-open'));

    await waitFor(() => {
      expect(mockFetchShellProfiles).toHaveBeenCalled();
    });
  });

  it('changes the toolbar scope filter and refreshes that scope', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.processVarSummaries = [makeSummary('PATH', '/usr/bin', 'process')];

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalled();
    });
    mockLoadDetection.mockClear();

    await userEvent.click(screen.getByRole('combobox', { name: 'envvar.table.scope' }));
    await userEvent.click(await screen.findByText('envvar.scopes.user'));

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalledWith('user', undefined);
    });
  });

  it('shows a pending refresh status banner with the action label', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(mockLoadDetection).toHaveBeenCalled();
    });
    mockLoadDetection.mockClear();
    mockLoadDetection.mockImplementationOnce(() => new Promise(() => undefined));

    await userEvent.click(screen.getByRole('button', { name: 'envvar.actions.refresh' }));

    expect(screen.getByTestId('envvar-operation-status')).toHaveTextContent('common.loading');
    expect(screen.getByTestId('envvar-operation-status')).toHaveTextContent('envvar.actions.refresh');
  });

  it('shows filtered count text when the toolbar search narrows results', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.processVarSummaries = [
      makeSummary('PATH', '/usr/bin', 'process'),
      makeSummary('JAVA_HOME', '/jdk', 'process'),
    ];

    render(<EnvVarPage />);

    await userEvent.type(screen.getByRole('textbox', { name: 'envvar.table.search' }), 'JAVA');

    expect(screen.getByText('envvar.table.showingFiltered')).toBeInTheDocument();
  });

  it('changes the path scope and reloads entries', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.pathEntries = [
      { path: '/usr/bin', exists: true, isDirectory: true, isDuplicate: false },
    ] as never[];

    render(<EnvVarPage />);

    await userEvent.click(
      screen.getByRole('tab', { name: /^envvar\.tabs\.pathEditor(?:\s+\d+)?$/ }),
    );

    await waitFor(() => {
      expect(mockFetchPath).toHaveBeenCalledWith('process');
    });
    mockFetchPath.mockClear();
    hookState.clearPathRepairPreview.mockClear();

    await userEvent.click(screen.getByRole('combobox', { name: 'envvar.table.scope' }));
    await userEvent.click(await screen.findByText('envvar.scopes.user'));

    await waitFor(() => {
      expect(hookState.clearPathRepairPreview).toHaveBeenCalled();
      expect(mockFetchPath).toHaveBeenCalledWith('user');
    });
  });

  it('routes inline edit and delete actions through the page handlers', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.processVarSummaries = [makeSummary('JAVA_HOME', '/jdk-21', 'process')];
    mockSetVar.mockResolvedValue(true);
    mockRemoveVar.mockResolvedValue(true);

    render(<EnvVarPage />);

    const editButtons = screen.getAllByRole('button').filter(
      (button) => button.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    const input = screen.getByDisplayValue('/jdk-21');
    await userEvent.clear(input);
    await userEvent.type(input, '/jdk-22{Enter}');

    await waitFor(() => {
      expect(mockSetVar).toHaveBeenCalledWith('JAVA_HOME', '/jdk-22', 'process');
    });

    const deleteButtons = screen.getAllByRole('button').filter(
      (button) => button.querySelector('.lucide-trash-2'),
    );
    await userEvent.click(deleteButtons[0]);
    await userEvent.click(screen.getByRole('button', { name: 'envvar.actions.delete' }));

    await waitFor(() => {
      expect(mockRemoveVar).toHaveBeenCalledWith('JAVA_HOME', 'process');
    });
  });

  it('routes reveal and path editor action callbacks through the page handlers', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.processVarSummaries = [
      {
        key: 'API_TOKEN',
        scope: 'process',
        value: {
          displayValue: '[hidden: 12 chars]',
          masked: true,
          hasValue: true,
          length: 12,
          isSensitive: true,
          sensitivityReason: 'token_key',
        },
      },
    ] as never[];
    hookState.pathEntries = [
      { path: '/usr/bin', exists: true, isDirectory: true, isDuplicate: false },
      { path: '/custom/bin', exists: true, isDirectory: true, isDuplicate: false },
    ] as never[];
    mockRevealVar.mockResolvedValue('revealed-token');
    mockAddPathEntry.mockResolvedValue(true);
    mockReorderPath.mockResolvedValue(true);
    mockRemovePathEntry.mockResolvedValue(true);

    render(<EnvVarPage />);

    await userEvent.click(screen.getByRole('button', { name: 'envvar.table.reveal' }));
    await waitFor(() => {
      expect(mockRevealVar).toHaveBeenCalledWith('API_TOKEN', 'process');
    });

    await userEvent.click(
      screen.getByRole('tab', { name: /^envvar\.tabs\.pathEditor(?:\s+\d+)?$/ }),
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'envvar.pathEditor.add' }), '/new/bin');
    await userEvent.click(screen.getByRole('button', { name: 'envvar.pathEditor.add' }));
    await waitFor(() => {
      expect(mockAddPathEntry).toHaveBeenCalledWith('/new/bin', 'process', undefined);
    });

    const moveDownButtons = screen.getAllByRole('button', { name: 'envvar.pathEditor.moveDown' });
    await userEvent.click(moveDownButtons[0]);
    await waitFor(() => {
      expect(mockReorderPath).toHaveBeenCalled();
    });

    const removeButtons = screen.getAllByRole('button', { name: 'envvar.pathEditor.remove' });
    await userEvent.click(removeButtons[0]);
    await userEvent.click(screen.getByRole('button', { name: 'envvar.actions.delete' }));
    await waitFor(() => {
      expect(mockRemovePathEntry).toHaveBeenCalledWith('/usr/bin', 'process');
    });
  });

  it('surfaces preview import errors from the import dialog', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    mockPreviewImportEnvFile.mockResolvedValue(null);

    render(<EnvVarPage />);

    await userEvent.click(screen.getByRole('button', { name: 'envvar.importExport.import' }));
    await userEvent.type(screen.getByRole('textbox'), 'FOO=bar');
    await userEvent.click(screen.getByRole('button', { name: 'envvar.importExport.preview' }));

    await waitFor(() => {
      expect(screen.getByTestId('envvar-operation-error')).toHaveTextContent('envvar.importExport.preview');
    });
  });

  it('applies import previews and surfaces manual follow-up notices', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.importPreview = {
      scope: 'user',
      fingerprint: 'preview-fingerprint',
      additions: 1,
      updates: 0,
      noops: 0,
      invalid: 0,
      skipped: 0,
      items: [{ key: 'JAVA_HOME', value: '/jdk', action: 'add', reason: null }],
      primaryShellTarget: null,
      shellGuidance: [],
    } as never;
    mockApplyImportPreview.mockResolvedValue({
      imported: 1,
      skipped: 0,
      errors: [],
      success: true,
      status: 'manual_followup_required',
      message: 'preview follow-up required',
    });

    render(<EnvVarPage />);

    await userEvent.click(screen.getByRole('button', { name: 'envvar.importExport.import' }));
    await userEvent.type(screen.getByRole('textbox'), 'JAVA_HOME=/jdk');
    await userEvent.click(screen.getByRole('button', { name: 'envvar.importExport.applyPreview' }));

    await waitFor(() => {
      expect(screen.getByTestId('envvar-operation-notice')).toHaveTextContent('preview follow-up required');
    });
  });

  it('surfaces export failures from the dialog actions', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    mockExportEnvFile.mockResolvedValueOnce(null);

    render(<EnvVarPage />);

    await userEvent.click(screen.getByRole('button', { name: 'envvar.importExport.export' }));
    const exportDialog = screen.getByRole('dialog');
    await userEvent.click(within(exportDialog).getByRole('tab', { name: 'envvar.importExport.export' }));
    const exportButtons = within(exportDialog).getAllByRole('button', { name: 'envvar.importExport.export' });
    fireEvent.click(exportButtons[exportButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-operation-error')).toHaveTextContent('envvar.importExport.export');
    });
  });

  it('surfaces path repair preview errors through the page handlers', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.pathEntries = [
      { path: '/missing', exists: false, isDirectory: false, isDuplicate: false },
    ] as never[];
    mockPreviewPathRepair.mockRejectedValueOnce(new Error('preview repair exploded'));

    render(<EnvVarPage />);

    await userEvent.click(
      screen.getByRole('tab', { name: /^envvar\.tabs\.pathEditor(?:\s+\d+)?$/ }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'envvar.pathEditor.previewRepair' }));
    await waitFor(() => {
      expect(screen.getByTestId('envvar-operation-error')).toHaveTextContent('preview repair exploded');
    });
  });

  it('surfaces path repair apply errors through the page handlers', async () => {
    mockIsTauri = true;
    hookState.detectionState = 'showing-fresh';
    hookState.pathEntries = [
      { path: '/missing', exists: false, isDirectory: false, isDuplicate: false },
    ] as never[];
    hookState.pathRepairPreview = {
      scope: 'process',
      fingerprint: 'repair-preview',
      currentEntries: ['/missing'],
      repairedEntries: [],
      duplicateCount: 0,
      missingCount: 1,
      removedCount: 1,
      primaryShellTarget: null,
      shellGuidance: [],
    } as never;
    mockApplyPathRepair.mockResolvedValueOnce(null);

    render(<EnvVarPage />);

    await userEvent.click(
      screen.getByRole('tab', { name: /^envvar\.tabs\.pathEditor(?:\s+\d+)?$/ }),
    );

    const previewShell = screen.getByTestId('envvar-path-repair-preview');
    const toggleButton = within(previewShell).getByRole('button', { name: 'envvar.pathEditor.repairPreviewReady' });
    fireEvent.click(toggleButton);
    const applyRepairButton = await screen.findByRole('button', { name: 'envvar.pathEditor.applyRepair' });
    await userEvent.click(applyRepairButton);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-operation-error')).toHaveTextContent('common.error');
    });
  });

  it('surfaces null conflict resolution results as action errors', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      { key: 'JAVA_HOME', userValue: 'A', systemValue: 'B', effectiveValue: 'A' },
    ];
    hookState.detectionState = 'showing-fresh';
    mockResolveConflict.mockResolvedValue(null);

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-table')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('envvar-conflict-system-to-user-JAVA_HOME'));

    await waitFor(() => {
      expect(screen.getByTestId('envvar-operation-error')).toHaveTextContent('envvar.conflicts.resolve');
    });
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
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
const mockImportEnvFile = jest.fn().mockResolvedValue(null);
const mockExportEnvFile = jest.fn().mockResolvedValue(null);
const mockDeduplicatePath = jest.fn().mockResolvedValue(0);
let mockIsTauri = false;

const hookState = {
  envVars: {} as Record<string, string>,
  userPersistentVarsTyped: [] as Array<{ key: string; value: string; regType?: string }>,
  systemPersistentVarsTyped: [] as Array<{ key: string; value: string; regType?: string }>,
  pathEntries: [] as never[],
  shellProfiles: [] as never[],
  conflicts: [] as Array<{ key: string; userValue: string; systemValue: string; effectiveValue: string }>,
  loading: false,
  error: null as string | null,
  detectionState: 'idle' as 'idle' | 'loading-no-cache' | 'showing-cache-refreshing' | 'showing-fresh' | 'empty' | 'error',
  detectionFromCache: false,
  detectionError: null as string | null,
  detectionCanRetry: false,
  setVar: mockSetVar,
  removeVar: mockRemoveVar,
  fetchPath: mockFetchPath,
  addPathEntry: mockAddPathEntry,
  removePathEntry: mockRemovePathEntry,
  reorderPath: mockReorderPath,
  fetchShellProfiles: mockFetchShellProfiles,
  readShellProfile: mockReadShellProfile,
  importEnvFile: mockImportEnvFile,
  exportEnvFile: mockExportEnvFile,
  deduplicatePath: mockDeduplicatePath,
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

  beforeEach(() => {
    mockIsTauri = false;
    hookState.envVars = {};
    hookState.userPersistentVarsTyped = [];
    hookState.systemPersistentVarsTyped = [];
    hookState.pathEntries = [];
    hookState.shellProfiles = [];
    hookState.conflicts = [];
    hookState.loading = false;
    hookState.error = null;
    hookState.detectionState = 'idle';
    hookState.detectionFromCache = false;
    hookState.detectionError = null;
    hookState.detectionCanRetry = false;
    mockSetVar.mockResolvedValue(true);
    mockLoadDetection.mockResolvedValue(null);
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
      expect(mockLoadDetection).toHaveBeenCalledWith('all', undefined);
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
  });
});

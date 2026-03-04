import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnvVarPage from './page';

const mockFetchAllVars = jest.fn().mockResolvedValue({});
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
const mockFetchPersistentVarsTyped = jest.fn().mockResolvedValue([]);
const mockDeduplicatePath = jest.fn().mockResolvedValue(0);
const mockDetectConflicts = jest.fn().mockResolvedValue([]);
let mockIsTauri = false;

const hookState = {
  envVars: {} as Record<string, string>,
  pathEntries: [] as never[],
  shellProfiles: [] as never[],
  conflicts: [] as Array<{ key: string; userValue: string; systemValue: string; effectiveValue: string }>,
  loading: false,
  error: null as string | null,
  fetchAllVars: mockFetchAllVars,
  getVar: jest.fn(),
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
  fetchPersistentVars: jest.fn().mockResolvedValue([]),
  fetchPersistentVarsTyped: mockFetchPersistentVarsTyped,
  deduplicatePath: mockDeduplicatePath,
  detectConflicts: mockDetectConflicts,
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
    hookState.pathEntries = [];
    hookState.shellProfiles = [];
    hookState.conflicts = [];
    hookState.loading = false;
    hookState.error = null;
    mockSetVar.mockResolvedValue(true);
    jest.clearAllMocks();
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

  it('should load process and persistent typed data on desktop init', async () => {
    mockIsTauri = true;
    render(<EnvVarPage />);

    await waitFor(() => {
      expect(mockFetchAllVars).toHaveBeenCalledTimes(1);
      expect(mockFetchPersistentVarsTyped).toHaveBeenCalledWith('user');
      expect(mockFetchPersistentVarsTyped).toHaveBeenCalledWith('system');
      expect(mockDetectConflicts).toHaveBeenCalledTimes(1);
    });
  });

  it('renders responsive action groups in desktop mode', async () => {
    mockIsTauri = true;
    render(<EnvVarPage />);

    expect(screen.getByTestId('envvar-header-actions')).toBeInTheDocument();
    expect(screen.getByTestId('envvar-header-actions-primary')).toBeInTheDocument();
    expect(screen.getByTestId('envvar-header-actions-secondary')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetchAllVars).toHaveBeenCalled();
    });
  });

  it('renders compact conflict summary on narrow viewport', async () => {
    mockIsTauri = true;
    hookState.conflicts = [
      {
        key: 'PATH',
        userValue: '/home/bin',
        systemValue: '/usr/bin',
        effectiveValue: '/home/bin',
      },
    ];
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 640 });

    render(<EnvVarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-compact-list')).toBeInTheDocument();
    });
  });

  it('shows operation error state when add mutation fails', async () => {
    mockIsTauri = true;
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

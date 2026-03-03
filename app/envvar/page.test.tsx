import { render, screen, waitFor } from '@testing-library/react';
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

jest.mock('@/hooks/use-envvar', () => ({
  useEnvVar: () => ({
    envVars: {},
    pathEntries: [],
    shellProfiles: [],
    conflicts: [],
    loading: false,
    error: null,
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
  }),
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
  beforeEach(() => {
    mockIsTauri = false;
    jest.clearAllMocks();
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
});

import { renderHook, act } from '@testing-library/react';
import { useProfiles } from './use-profiles';

// Mock Tauri APIs
const mockProfileList = jest.fn();
const mockProfileGet = jest.fn();
const mockProfileCreate = jest.fn();
const mockProfileUpdate = jest.fn();
const mockProfileDelete = jest.fn();
const mockProfileApply = jest.fn();
const mockProfileExport = jest.fn();
const mockProfileImport = jest.fn();
const mockProfileCreateFromCurrent = jest.fn();
const mockSetWorkflowActionState = jest.fn();
const mockReconcileEnvironmentWorkflow = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  profileList: (...args: unknown[]) => mockProfileList(...args),
  profileGet: (...args: unknown[]) => mockProfileGet(...args),
  profileCreate: (...args: unknown[]) => mockProfileCreate(...args),
  profileUpdate: (...args: unknown[]) => mockProfileUpdate(...args),
  profileDelete: (...args: unknown[]) => mockProfileDelete(...args),
  profileApply: (...args: unknown[]) => mockProfileApply(...args),
  profileExport: (...args: unknown[]) => mockProfileExport(...args),
  profileImport: (...args: unknown[]) => mockProfileImport(...args),
  profileCreateFromCurrent: (...args: unknown[]) => mockProfileCreateFromCurrent(...args),
}));

jest.mock('@/hooks/environments/use-environment-workflow', () => ({
  useEnvironmentWorkflow: () => ({
    syncWorkflowContext: jest.fn(),
    setWorkflowActionState: mockSetWorkflowActionState,
    requireProjectPath: jest.fn(),
    requirePathConfigured: jest.fn(),
    reconcileEnvironmentWorkflow: mockReconcileEnvironmentWorkflow,
  }),
}));

describe('useProfiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileList.mockResolvedValue([]);
    mockProfileCreateFromCurrent.mockResolvedValue({ id: 'created', name: 'Current', environments: [] });
  });

  it('should return profile methods', () => {
    const { result } = renderHook(() => useProfiles());

    expect(result.current).toHaveProperty('profiles');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');
    expect(result.current).toHaveProperty('createProfile');
    expect(result.current).toHaveProperty('deleteProfile');
  });

  it('should refresh profiles', async () => {
    const profiles = [
      { id: '1', name: 'Dev', env_type: 'python' },
      { id: '2', name: 'Prod', env_type: 'node' },
    ];
    mockProfileList.mockResolvedValue(profiles);
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockProfileList).toHaveBeenCalled();
    expect(result.current.profiles).toEqual(profiles);
  });

  it('should get profile by id', async () => {
    const profile = { id: '1', name: 'Dev', env_type: 'python' };
    mockProfileGet.mockResolvedValue(profile);
    const { result } = renderHook(() => useProfiles());

    let fetched;
    await act(async () => {
      fetched = await result.current.getProfile('1');
    });

    expect(mockProfileGet).toHaveBeenCalledWith('1');
    expect(fetched).toEqual(profile);
  });

  it('should create profile', async () => {
    const newProfile = { id: '3', name: 'Test', environments: [] };
    mockProfileCreate.mockResolvedValue(newProfile);
    mockProfileList.mockResolvedValue([newProfile]);
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.createProfile('Test', null, []);
    });

    expect(mockProfileCreate).toHaveBeenCalledWith('Test', null, [], undefined);
  });

  it('forwards env snapshot options when creating a profile', async () => {
    const newProfile = { id: '4', name: 'Snapshot', environments: [] };
    mockProfileCreate.mockResolvedValue(newProfile);
    mockProfileList.mockResolvedValue([newProfile]);
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.createProfile('Snapshot', null, [], {
        wslSnapshot: null,
        envSnapshot: {
          JAVA_HOME: '/jdk',
          NODE_ENV: 'development',
        },
      });
    });

    expect(mockProfileCreate).toHaveBeenCalledWith('Snapshot', null, [], {
      wslSnapshot: null,
      envSnapshot: {
        JAVA_HOME: '/jdk',
        NODE_ENV: 'development',
      },
    });
  });

  it('should delete profile', async () => {
    mockProfileDelete.mockResolvedValue(true);
    mockProfileList.mockResolvedValue([]);
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.deleteProfile('1');
    });

    expect(mockProfileDelete).toHaveBeenCalledWith('1');
  });

  it('should apply profile', async () => {
    mockProfileList.mockResolvedValue([
      {
        id: '1',
        name: 'Dev',
        environments: [{ env_type: 'node', version: '20.0.0', provider_id: 'fnm' }],
      },
    ]);
    mockProfileApply.mockResolvedValue({
      profile_id: '1',
      profile_name: 'Dev',
      successful: [{ env_type: 'node', version: '20.0.0', provider_id: 'fnm' }],
      failed: [],
      skipped: [],
    });
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.refresh();
    });

    await act(async () => {
      await result.current.applyProfile('1');
    });

    expect(mockProfileApply).toHaveBeenCalledWith('1');
    expect(mockSetWorkflowActionState).toHaveBeenCalledWith(
      'node',
      'applyProfile',
      'running',
      expect.any(Object),
    );
    expect(mockSetWorkflowActionState).toHaveBeenCalledWith(
      'node',
      'applyProfile',
      'success',
      expect.any(Object),
    );
    expect(mockReconcileEnvironmentWorkflow).toHaveBeenCalled();
  });

  it('marks profile apply as error when any environment fails', async () => {
    mockProfileApply.mockResolvedValue({
      profile_id: '1',
      profile_name: 'Dev',
      successful: [{ env_type: 'node', version: '20.0.0', provider_id: 'fnm' }],
      failed: [{ env_type: 'python', version: '3.11.0', error: 'Not installed' }],
      skipped: [],
    });
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.applyProfile('1');
    });

    expect(mockSetWorkflowActionState).toHaveBeenCalledWith(
      'node',
      'applyProfile',
      'error',
      expect.objectContaining({
        error: '1 environment(s) failed while applying this profile.',
      }),
    );
  });

  it('should handle refresh error', async () => {
    const error = new Error('Fetch failed');
    mockProfileList.mockRejectedValue(error);
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should set loading state during refresh', async () => {
    mockProfileList.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    );
    const { result } = renderHook(() => useProfiles());

    let loadingDuringFetch = false;
    act(() => {
      result.current.refresh();
      loadingDuringFetch = result.current.loading;
    });

    expect(loadingDuringFetch).toBe(true);
  });

  it('forwards WSL snapshot capture options when creating from current state', async () => {
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.createFromCurrent('WSL Ready', {
        includeWslConfiguration: true,
        includeEnvSnapshot: true,
      });
    });

    expect(mockProfileCreateFromCurrent).toHaveBeenCalledWith('WSL Ready', {
      includeWslConfiguration: true,
      includeEnvSnapshot: true,
    });
  });
});

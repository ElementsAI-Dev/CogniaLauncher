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
}));

describe('useProfiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileList.mockResolvedValue([]);
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

    expect(mockProfileCreate).toHaveBeenCalledWith('Test', null, []);
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
    mockProfileApply.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useProfiles());

    await act(async () => {
      await result.current.applyProfile('1');
    });

    expect(mockProfileApply).toHaveBeenCalledWith('1');
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
});

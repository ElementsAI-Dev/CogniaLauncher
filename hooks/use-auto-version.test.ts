import { renderHook, act } from '@testing-library/react';
import { useAutoVersionSwitch, useProjectPath } from './use-auto-version';

// Mock Tauri APIs
const mockEnvDetectVersion = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  envDetectVersion: (...args: unknown[]) => mockEnvDetectVersion(...args),
}));

// Mock environment store
const mockSetLocalVersion = jest.fn();
jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: jest.fn(() => ({
    environments: [
      { type: 'python', globalVersion: '3.11.0', localVersion: null },
    ],
    setLocalVersion: mockSetLocalVersion,
  })),
}));

// Mock useEnvironments hook
jest.mock('./use-environments', () => ({
  useEnvironments: () => ({
    setLocalVersion: mockSetLocalVersion,
  }),
}));

describe('useAutoVersionSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return auto version state', () => {
    const { result } = renderHook(() => useAutoVersionSwitch({ projectPath: null, enabled: false }));

    expect(result.current).toBeDefined();
  });

  it('should return hook when enabled with path', () => {
    const { result } = renderHook(() => 
      useAutoVersionSwitch({ enabled: true, projectPath: '/project' })
    );

    // Hook should be defined and return expected structure
    expect(result.current).toBeDefined();
  });

  it('should not detect when disabled', async () => {
    renderHook(() => 
      useAutoVersionSwitch({ enabled: false, projectPath: '/project' })
    );

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockEnvDetectVersion).not.toHaveBeenCalled();
  });

  it('should not detect without project path', async () => {
    renderHook(() => useAutoVersionSwitch({ projectPath: null, enabled: true }));

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockEnvDetectVersion).not.toHaveBeenCalled();
  });
});

describe('useProjectPath', () => {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  it('should return project path state', () => {
    localStorageMock.getItem.mockReturnValue(null);
    const { result } = renderHook(() => useProjectPath());

    expect(result.current).toHaveProperty('projectPath');
    expect(result.current).toHaveProperty('setProjectPath');
    expect(result.current).toHaveProperty('clearProjectPath');
  });

  it('should initialize from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('/saved/path');
    const { result } = renderHook(() => useProjectPath());

    expect(result.current.projectPath).toBe('/saved/path');
  });

  it('should set project path', () => {
    localStorageMock.getItem.mockReturnValue(null);
    const { result } = renderHook(() => useProjectPath());

    act(() => {
      result.current.setProjectPath('/new/path');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      expect.any(String),
      '/new/path'
    );
    expect(result.current.projectPath).toBe('/new/path');
  });

  it('should clear project path', () => {
    localStorageMock.getItem.mockReturnValue('/some/path');
    const { result } = renderHook(() => useProjectPath());

    act(() => {
      result.current.clearProjectPath();
    });

    expect(localStorageMock.removeItem).toHaveBeenCalled();
    expect(result.current.projectPath).toBeNull();
  });
});

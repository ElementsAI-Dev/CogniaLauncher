import { act, renderHook } from '@testing-library/react';
import { useEnvironmentDetection } from './use-environment-detection';

const mockIsTauri = jest.fn(() => true);
const mockEnvDetectSystemAll = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: (...args: Parameters<typeof mockIsTauri>) => mockIsTauri(...args),
  envDetectSystemAll: (...args: Parameters<typeof mockEnvDetectSystemAll>) =>
    mockEnvDetectSystemAll(...args),
}));

describe('useEnvironmentDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockEnvDetectSystemAll.mockResolvedValue([]);
  });

  it('matches project detection by logical env type', () => {
    const { result } = renderHook(() => useEnvironmentDetection({
      detectedVersions: [
        {
          env_type: 'node',
          version: '20.10.0',
          source: '.nvmrc',
          source_path: '/project/.nvmrc',
        },
      ],
      availableProviders: [
        {
          id: 'fnm',
          display_name: 'fnm',
          env_type: 'node',
          description: '',
        },
      ],
    }));

    expect(result.current.getProjectDetectedForEnv('fnm')?.version).toBe('20.10.0');
  });

  it('short-circuits system detection in web mode', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useEnvironmentDetection());

    let detected: Awaited<ReturnType<typeof result.current.detectSystemEnvironments>> = [];
    await act(async () => {
      detected = await result.current.detectSystemEnvironments();
    });

    expect(detected).toEqual([]);
    expect(result.current.systemDetections).toEqual([]);
    expect(result.current.systemDetectError).toBeNull();
    expect(mockEnvDetectSystemAll).not.toHaveBeenCalled();
  });

  it('stores system detections and supports logical matching', async () => {
    const systemDetected = [
      {
        env_type: 'system-node',
        version: '20.11.1',
        executable_path: '/usr/bin/node',
        source: 'node --version',
      },
    ];
    mockEnvDetectSystemAll.mockResolvedValue(systemDetected);

    const { result } = renderHook(() => useEnvironmentDetection({
      availableProviders: [
        {
          id: 'system-node',
          display_name: 'System Node',
          env_type: 'node',
          description: '',
        },
      ],
    }));

    await act(async () => {
      await result.current.detectSystemEnvironments();
    });

    expect(result.current.systemDetections).toEqual(systemDetected);
    expect(result.current.matchSystemByEnvType('node')).toEqual(systemDetected[0]);
  });

  it('builds onboarding detections by merging managed and system results', () => {
    const { result } = renderHook(() => useEnvironmentDetection());

    const detections = result.current.buildOnboardingDetections({
      environments: [
        {
          env_type: 'fnm',
          provider_id: 'fnm',
          provider: 'fnm',
          current_version: null,
          installed_versions: [],
          available: false,
          total_size: 0,
          version_count: 0,
        },
        {
          env_type: 'python',
          provider_id: 'pyenv',
          provider: 'pyenv',
          current_version: '3.12.1',
          installed_versions: [],
          available: true,
          total_size: 0,
          version_count: 0,
        },
      ],
      systemDetections: [
        {
          env_type: 'node',
          version: '20.10.0',
          executable_path: '/usr/bin/node',
          source: 'node --version',
        },
      ],
      providers: [
        {
          id: 'fnm',
          display_name: 'fnm',
          env_type: 'node',
          description: '',
        },
      ],
    });

    expect(detections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        envType: 'node',
        name: 'Node.js',
        version: '20.10.0',
        available: true,
        source: 'node --version',
        sourcePath: '/usr/bin/node',
        scope: 'system',
      }),
      expect.objectContaining({
        envType: 'python',
        name: 'Python',
        version: '3.12.1',
        available: true,
        scope: 'managed',
      }),
    ]));
  });
});

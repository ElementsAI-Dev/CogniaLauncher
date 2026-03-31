import { act, renderHook } from '@testing-library/react';
import { useEnvironmentDetection } from './use-environment-detection';

const mockIsTauri = jest.fn(() => true);
const mockEnvDetectSystemAll = jest.fn();
const mockEnvDetectProvidersAll = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: (...args: Parameters<typeof mockIsTauri>) => mockIsTauri(...args),
  envDetectSystemAll: (...args: Parameters<typeof mockEnvDetectSystemAll>) =>
    mockEnvDetectSystemAll(...args),
  envDetectProvidersAll: (...args: Parameters<typeof mockEnvDetectProvidersAll>) =>
    mockEnvDetectProvidersAll(...args),
}));

describe('useEnvironmentDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockEnvDetectSystemAll.mockResolvedValue([]);
    mockEnvDetectProvidersAll.mockResolvedValue([]);
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
    expect(mockEnvDetectProvidersAll).not.toHaveBeenCalled();
  });

  it('stores system detections and supports logical matching', async () => {
    const systemDetected = [
      {
        env_type: 'node',
        provider_id: 'system-node',
        provider_name: 'System Node',
        version: '20.11.1',
        executable_path: '/usr/bin/node',
        source: 'system-node',
        scope: 'system' as const,
      },
    ];
    mockEnvDetectProvidersAll.mockResolvedValue(systemDetected);

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
    expect(result.current.matchSystemByEnvType('node', 'system-node')).toEqual(systemDetected[0]);
  });

  it('falls back to env-type matching when the provider id does not match', async () => {
    const systemDetected = [
      {
        env_type: 'node',
        provider_id: 'system-node',
        provider_name: 'System Node',
        version: '20.11.1',
        executable_path: '/usr/bin/node',
        source: 'system-node',
        scope: 'system' as const,
      },
    ];
    mockEnvDetectProvidersAll.mockResolvedValue(systemDetected);

    const { result } = renderHook(() => useEnvironmentDetection());

    await act(async () => {
      await result.current.detectSystemEnvironments();
    });

    expect(result.current.matchSystemByEnvType('node', 'fnm')).toEqual(systemDetected[0]);
  });

  it('surfaces system detection errors to the caller', async () => {
    mockEnvDetectProvidersAll.mockRejectedValue(new Error('Permission denied'));
    const { result } = renderHook(() => useEnvironmentDetection());

    await act(async () => {
      await expect(result.current.detectSystemEnvironments()).rejects.toThrow('Permission denied');
    });

    expect(result.current.systemDetections).toEqual([]);
    expect(result.current.systemDetectError).toBe('Permission denied');
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
          provider_id: 'system-node',
          provider_name: 'System Node',
          version: '20.10.0',
          executable_path: '/usr/bin/node',
          source: 'system-node',
          scope: 'system' as const,
        },
        {
          env_type: 'cpp',
          provider_id: 'msvc',
          provider_name: 'MSVC',
          version: '19.42.34436',
          executable_path: 'C:/VS/VC/Tools/MSVC/14.42.34433/bin/Hostx64/x64/cl.exe',
          source: 'msvc',
          scope: 'system' as const,
          compiler_metadata: {
            family: 'msvc',
            variant: 'cl',
            version: '19.42.34436',
            target_architecture: 'x64',
            host_architecture: 'x64',
            target_triple: null,
            subsystem: null,
            discovery_origin: 'vswhere',
            executable_name: 'cl.exe',
          },
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
        providerId: 'system-node',
        providerName: 'System Node',
        version: '20.10.0',
        available: true,
        source: 'system-node',
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
      expect.objectContaining({
        envType: 'cpp',
        providerId: 'msvc',
        providerName: 'MSVC',
        compilerLabel: 'cl 19.42.34436 x64',
      }),
    ]));
  });

  it('infers managed scope for provider detections with an unknown scope marker', () => {
    const { result } = renderHook(() => useEnvironmentDetection());

    const detections = result.current.buildOnboardingDetections({
      environments: [],
      systemDetections: [
        {
          env_type: 'node',
          provider_id: 'fnm',
          provider_name: 'fnm',
          version: '20.11.0',
          executable_path: '/Users/test/.fnm/node',
          source: '.nvmrc',
          scope: 'other' as 'managed',
        },
      ],
    });

    expect(detections).toEqual([
      expect.objectContaining({
        detectionKey: 'node::fnm',
        scope: 'managed',
      }),
    ]);
  });
});

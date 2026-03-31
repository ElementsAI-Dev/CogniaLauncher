import {
  buildProviderDetectionKey,
  formatCppCompilerLabel,
  formatDetectionSource,
  isDetectedVersionCompatible,
  matchDetectedByEnvType,
} from './environment-detection';

describe('environment-detection utils', () => {
  it('matches detected versions by logical env type', () => {
    const detected = [
      { env_type: 'node', version: '20.10.0', source: '.nvmrc', source_path: null },
      { env_type: 'python', version: '3.12.1', source: '.python-version', source_path: null },
    ];

    expect(matchDetectedByEnvType('fnm', detected, [])?.version).toBe('20.10.0');
    expect(matchDetectedByEnvType('pyenv', detected, [])?.version).toBe('3.12.1');
  });

  it('matches using provider mapping from available providers', () => {
    const detected = [
      { env_type: 'node', version: '20.0.0', source: '.nvmrc', source_path: null },
    ];
    const providers = [{ id: 'volta-custom', env_type: 'node' }];

    expect(matchDetectedByEnvType('volta-custom', detected, providers)?.version).toBe('20.0.0');
  });

  it('prefers provider-aware match when provider id is given', () => {
    const detected = [
      { env_type: 'cpp', provider_id: 'msvc', version: '19.4', source: 'msvc', source_path: null },
      { env_type: 'cpp', provider_id: 'msys2', version: '13.2', source: 'msys2', source_path: null },
    ];

    expect(matchDetectedByEnvType('cpp', detected, [], 'msys2')?.version).toBe('13.2');
    expect(matchDetectedByEnvType('cpp', detected, [], 'msvc')?.version).toBe('19.4');
  });

  it('returns null when no detected version matches the requested environment', () => {
    const detected = [
      { env_type: 'node', version: '20.10.0', source: '.nvmrc', source_path: null },
    ];

    expect(matchDetectedByEnvType('python', detected, [])).toBeNull();
    expect(matchDetectedByEnvType('node', detected, [], 'fnm')?.version).toBe('20.10.0');
  });

  it('checks compatibility with boundary prefixes', () => {
    expect(isDetectedVersionCompatible('v20.10.0', '20')).toBe(true);
    expect(isDetectedVersionCompatible('20.10.0', 'v20.10.0')).toBe(true);
    expect(isDetectedVersionCompatible('go1.22.1', '1.22')).toBe(true);
    expect(isDetectedVersionCompatible('10.0.0', '1')).toBe(false);
    expect(isDetectedVersionCompatible('3.12.0', '2')).toBe(false);
    expect(isDetectedVersionCompatible('', '3.12')).toBe(false);
  });

  it('formats detection source labels', () => {
    expect(formatDetectionSource('system', 'global')).toBe('global default');
    expect(formatDetectionSource('tool_versions_file')).toBe('tool versions file');
    expect(formatDetectionSource('vcpkg.json', 'manifest')).toBe('vcpkg.json');
    expect(formatDetectionSource('conanfile.txt', 'manifest')).toBe('conanfile.txt');
    expect(formatDetectionSource('package.json', 'manifest')).toBe('project manifest');
  });

  it('formats compiler labels for C++ toolchains', () => {
    expect(formatCppCompilerLabel({
      family: 'clang',
      variant: 'clang-cl',
      version: '18.1.8',
      target_architecture: 'x64',
      host_architecture: 'x64',
      target_triple: 'x86_64-pc-windows-msvc',
      subsystem: null,
      discovery_origin: 'path',
      executable_name: 'clang-cl.exe',
    })).toBe('clang-cl 18.1.8 x64');

    expect(formatCppCompilerLabel({
      family: 'gcc',
      variant: 'g++',
      version: '13.2.0',
      target_architecture: 'x64',
      host_architecture: null,
      target_triple: 'x86_64-w64-windows-gnu',
      subsystem: 'ucrt64',
      discovery_origin: 'msys2-root',
      executable_name: 'g++.exe',
    })).toBe('ucrt64 g++ 13.2.0 x64');
  });

  it('builds stable provider detection keys', () => {
    expect(buildProviderDetectionKey(' Cpp ', ' MSVC ')).toBe('cpp::msvc');
    expect(buildProviderDetectionKey('node')).toBe('node::unknown');
  });
});

jest.mock('@cognia/plugin-sdk', () => ({
  cognia: {
    platform: {
      info: jest.fn(() => ({
        os: 'linux',
        arch: 'x64',
        hostname: 'test-host',
        osVersion: 'test-os',
      })),
    },
    process: {
      exec: jest.fn(() => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })),
    },
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  },
}));

const plugin = require('./index');
const testApi = plugin.__test;

describe('aab-to-apk parser and helpers', () => {
  it('parses quick input as convert operation with defaults', () => {
    const parsed = testApi.parseInput('D:/android/app-release.aab');
    expect('input' in parsed).toBe(true);
    if (!('input' in parsed)) {
      return;
    }

    expect(parsed.input.operation).toBe('convert');
    expect(parsed.input.mode).toBe('universal');
    expect(parsed.input.bundletoolJarPath).toBe('bundletool.jar');
    expect(parsed.input.javaPath).toBe('java');
    expect(parsed.input.overwrite).toBe(true);
  });

  it('parses preflight json input', () => {
    const parsed = testApi.parseInput(
      JSON.stringify({
        operation: 'preflight',
        aabPath: 'D:/android/app-release.aab',
        outputApkPath: 'D:/android/out/app-universal.apk',
      }),
    );
    expect('input' in parsed).toBe(true);
    if (!('input' in parsed)) {
      return;
    }

    expect(parsed.input.operation).toBe('preflight');
    expect(parsed.input.outputApkPath).toBe('D:/android/out/app-universal.apk');
  });

  it('rejects unsupported mode', () => {
    expect(() =>
      testApi.parseInput(
        JSON.stringify({
          aabPath: 'D:/android/app-release.aab',
          mode: 'default',
        }),
      ),
    ).toThrow('Unsupported mode');
  });

  it('validates signing field combinations', () => {
    expect(() =>
      testApi.validateSigningConfiguration({
        operation: 'convert',
        aabPath: 'D:/android/app-release.aab',
        bundletoolJarPath: 'bundletool.jar',
        javaPath: 'java',
        mode: 'universal',
        overwrite: true,
        cleanup: true,
        keepApks: false,
        keepExtracted: false,
        ksPath: 'D:/android/upload.jks',
        ksKeyAlias: 'upload',
      }),
    ).toThrow('ksPass is required');
  });

  it('builds conversion args and redacts secrets in helper', () => {
    const input = {
      operation: 'convert',
      aabPath: 'D:/android/app-release.aab',
      outputApkPath: 'D:/android/app-universal.apk',
      bundletoolJarPath: 'D:/tools/bundletool.jar',
      javaPath: 'java',
      mode: 'universal',
      overwrite: true,
      cleanup: true,
      keepApks: false,
      keepExtracted: false,
      ksPath: 'D:/android/upload.jks',
      ksPass: 'upload-secret',
      ksKeyAlias: 'upload',
      keyPass: 'key-secret',
    };
    const plan = testApi.buildConversionPlan(input);
    const args = testApi.buildBuildApksArgs(input, plan);

    expect(args).toContain('--overwrite');
    expect(args).toContain('--mode=universal');
    expect(args).toContain('--ks-pass=pass:upload-secret');
    expect(args).toContain('--key-pass=pass:key-secret');
    expect(testApi.redactArg('--ks-pass=pass:upload-secret')).toBe('--ks-pass=***');
  });
});

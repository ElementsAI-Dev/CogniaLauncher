const platformInfoMock = jest.fn(() => ({
  os: 'windows',
  arch: 'x64',
  hostname: 'dev-host',
  osVersion: '11',
}));
const envListMock = jest.fn(() => [
  { id: 'node', displayName: 'Node.js' },
  { id: 'python', displayName: 'Python' },
  { id: 'rust', displayName: 'Rust' },
]);
const providerListMock = jest.fn(() => [
  {
    id: 'npm',
    displayName: 'npm',
    capabilities: ['pkg_search', 'pkg_install'],
    platforms: ['windows', 'linux'],
    priority: 100,
    isEnvironmentProvider: true,
    enabled: true,
  },
]);
const envDetectMock = jest.fn((envType: string) => {
  if (envType === 'python') {
    return { available: true, currentVersion: null, installedVersions: [] };
  }
  return { available: true, currentVersion: '1.0.0', installedVersions: ['1.0.0'] };
});
const emitMock = jest.fn();
const getPluginIdMock = jest.fn(() => 'com.cognia.builtin.env-provider-audit');
const notifyMock = jest.fn();

jest.mock('@cognia/plugin-sdk', () => ({
  cognia: {
    platform: { info: platformInfoMock },
    env: {
      list: envListMock,
      providerList: providerListMock,
      detect: envDetectMock,
    },
    event: {
      emit: emitMock,
      getPluginId: getPluginIdMock,
    },
    notification: { send: notifyMock },
  },
}));

const plugin = require('./index');
const testApi = plugin.__test;

describe('env-provider-audit helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses defaults for empty input', () => {
    expect(testApi.parseInput('')).toEqual({
      envTypes: ['node', 'python', 'rust'],
      includeProviders: true,
      notifyOnIssues: false,
      emitEvent: true,
    });
  });

  it('validates envTypes input shape', () => {
    expect(() => testApi.parseInput('{"envTypes":"node"}')).toThrow('envTypes must be an array of strings.');
  });

  it('builds audit result and emits event', () => {
    const result = testApi.runAudit({
      envTypes: ['node', 'python'],
      includeProviders: true,
      notifyOnIssues: true,
      emitEvent: true,
    });

    expect(result.ok).toBe(true);
    expect(result.providers).toHaveLength(1);
    expect(result.environments).toHaveLength(2);
    expect(result.issues.some((issue: string) => issue.includes('python'))).toBe(true);
    expect(emitMock).toHaveBeenCalledWith(
      'builtin.env_provider_audit.completed',
      expect.objectContaining({ issueCount: result.issues.length }),
    );
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it('generates recommendation when providers are omitted', () => {
    const recommendations = testApi.buildRecommendations(
      [
        {
          envType: 'node',
          declaredByHost: true,
          available: false,
          currentVersion: null,
          installedVersions: [],
        },
      ],
      [],
      1,
    );

    expect(recommendations).toContain('Enable includeProviders=true to inspect provider capabilities for deeper diagnostics.');
  });

  it('renders guided workflow form for the initial declarative state', () => {
    const response = testApi.renderGuided('');

    expect(response.ui).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'heading', content: 'Env Provider Audit Workflow' }),
        expect.objectContaining({
          type: 'form',
          id: 'env-provider-audit-guided-form',
        }),
      ]),
    );
    expect(response.state).toMatchObject({
      lastInput: {
        envTypes: ['node', 'python', 'rust'],
        includeProviders: true,
      },
    });
    expect(response.outputChannels?.summary).toEqual(
      expect.objectContaining({
        status: 'info',
      }),
    );
  });

  it('preserves audit results when notification follow-up fails in guided workflow mode', () => {
    notifyMock.mockImplementation(() => {
      throw new Error('notification permission denied');
    });

    const response = testApi.renderGuided(JSON.stringify({
      action: 'form_submit',
      formId: 'env-provider-audit-guided-form',
      formData: {
        envTypes: ['node', 'python'],
        includeProviders: true,
        notifyOnIssues: true,
        emitEvent: true,
      },
    }));

    expect(response.outputChannels?.summary).toEqual(
      expect.objectContaining({
        status: 'warning',
        message: expect.stringContaining('completed with'),
      }),
    );
    expect(response.outputChannels?.stream).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('notification'),
        }),
      ]),
    );
    expect(response.outputChannels?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'env-provider-audit-report',
          action: 'copy',
        }),
      ]),
    );
    expect(response.state).toMatchObject({
      degradedCapabilities: [
        expect.objectContaining({ capability: 'notification' }),
      ],
      lastSuccess: expect.objectContaining({
        ok: true,
        environments: expect.any(Array),
      }),
    });
  });
});

const listInstalledMock = jest.fn(() => [
  { name: 'react', version: '18.2.0', provider: 'npm' },
  { name: 'next', version: '16.0.0', provider: 'npm' },
]);
const checkUpdatesMock = jest.fn(() => [
  { name: 'react', currentVersion: '18.2.0', latestVersion: '19.0.0' },
]);
const clipboardWriteMock = jest.fn();
const notificationSendMock = jest.fn();
const eventEmitMock = jest.fn();

jest.mock('@cognia/plugin-sdk', () => ({
  cognia: {
    pkg: {
      listInstalled: listInstalledMock,
      checkUpdates: checkUpdatesMock,
    },
    clipboard: {
      write: clipboardWriteMock,
    },
    notification: {
      send: notificationSendMock,
    },
    event: {
      emit: eventEmitMock,
    },
  },
}));

const plugin = require('./index');
const testApi = plugin.__test;

describe('pkg-update-advisor helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses defaults for empty input', () => {
    expect(testApi.parseInput('')).toEqual({
      provider: 'npm',
      packages: [],
      limit: 30,
      copySummary: false,
      notifyOnUpdates: false,
      emitEvent: true,
    });
  });

  it('rejects invalid limit', () => {
    expect(() => testApi.parseInput('{"limit":0}')).toThrow('limit must be an integer between 1 and 500.');
  });

  it('uses installed packages when explicit package list is not provided', () => {
    const result = testApi.runAdvisor({
      provider: 'npm',
      packages: [],
      limit: 20,
      copySummary: true,
      notifyOnUpdates: true,
      emitEvent: true,
    });

    expect(result.ok).toBe(true);
    expect(result.targetPackages).toEqual(['react', 'next']);
    expect(result.updateCount).toBe(1);
    expect(clipboardWriteMock).toHaveBeenCalledTimes(1);
    expect(notificationSendMock).toHaveBeenCalledTimes(1);
    expect(eventEmitMock).toHaveBeenCalledWith(
      'builtin.pkg_update_advisor.completed',
      expect.objectContaining({ provider: 'npm', updateCount: 1 }),
    );
  });

  it('produces recommendation when no targets are selected', () => {
    expect(testApi.buildRecommendations([], [])).toEqual([
      'No target packages were selected. Pass packages explicitly or ensure provider has installed packages.',
    ]);
  });
});

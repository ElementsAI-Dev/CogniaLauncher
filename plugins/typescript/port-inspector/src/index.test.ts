jest.mock('@cognia/plugin-sdk', () => ({
  cognia: {
    platform: {
      info: jest.fn(() => ({ os: 'linux', arch: 'x64', hostname: 'test-host', osVersion: 'test-os' })),
    },
    process: {
      exec: jest.fn(),
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

describe('port-inspector helpers', () => {
  it('parses raw port input', () => {
    expect(testApi.parseInput('3000')).toEqual({ port: 3000 });
  });

  it('parses targeted socket filters from JSON input', () => {
    expect(testApi.parseInput(JSON.stringify({
      port: 3000,
      addressContains: '127.0.0.1',
      processNameContains: 'node',
      processId: 4321,
    }))).toEqual({
      port: 3000,
      addressContains: '127.0.0.1',
      processNameContains: 'node',
      processId: 4321,
    });
  });

  it('parses netstat output', () => {
    const rows = testApi.parseNetstatWindows(`
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    127.0.0.1:9229         0.0.0.0:0              LISTENING       2345
`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ address: '0.0.0.0', port: 3000, processId: 1234 });
  });

  it('parses lsof output', () => {
    const rows = testApi.parseLsof(`
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     1234 max   21u  IPv4 0x123      0t0  TCP *:3000 (LISTEN)
`);
    expect(rows).toEqual([
      expect.objectContaining({ processName: 'node', processId: 1234, address: '*', port: 3000 }),
    ]);
  });

  it('keeps partial metadata explicit when ss cannot resolve a process', () => {
    const rows = testApi.parseSs(`
State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess
LISTEN 0      4096   127.0.0.1:3000      0.0.0.0:*
`);

    expect(rows).toEqual([
      expect.objectContaining({
        protocol: 'tcp',
        state: 'LISTEN',
        address: '127.0.0.1',
        port: 3000,
        metadataMissing: ['processName', 'processId'],
      }),
    ]);
  });

  it('returns filtered no-result guidance for targeted lookups', () => {
    expect(testApi.buildRecommendations([], {
      port: 3000,
      processNameContains: 'node',
    })).toEqual([
      'No listening socket matched the requested filters (port 3000, process name containing "node").',
      'Retry without one of the filters if you need a broader listener inventory.',
    ]);
  });
});

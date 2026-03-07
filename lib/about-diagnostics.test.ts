import {
  buildSystemSectionSummary,
  buildWebDiagnosticsReport,
  redactIpAddress,
  redactMacAddress,
  sanitizeNetworks,
} from './about-diagnostics';

jest.mock('@/lib/app-version', () => ({ APP_VERSION: '9.9.9-test' }));

describe('about-diagnostics', () => {
  it('redacts ipv4 and ipv6 addresses', () => {
    expect(redactIpAddress('192.168.1.20')).toBe('192.168.1.*');
    expect(redactIpAddress('2001:0db8:85a3::8a2e:0370:7334')).toBe(
      '2001:0db8::****',
    );
  });

  it('redacts mac addresses', () => {
    expect(redactMacAddress('aa:bb:cc:dd:ee:ff')).toBe('AABBCC******');
  });

  it('sanitizes network payloads without raw identifiers', () => {
    const [network] = sanitizeNetworks([
      {
        name: 'eth0',
        macAddress: 'aa:bb:cc:dd:ee:ff',
        ipAddresses: ['10.0.0.42'],
        totalReceived: 1,
        totalTransmitted: 2,
        totalReceivedHuman: '1 B',
        totalTransmittedHuman: '2 B',
        mtu: 1500,
        totalPacketsReceived: 3,
        totalPacketsTransmitted: 4,
        totalErrorsOnReceived: 0,
        totalErrorsOnTransmitted: 0,
      },
    ] as never);

    expect(network).toMatchObject({
      name: 'eth0',
      ipAddressCount: 1,
      ipAddressesRedacted: ['10.0.0.*'],
      macAddressRedacted: 'AABBCC******',
    });
    expect(network).not.toHaveProperty('macAddress');
    expect(network).not.toHaveProperty('ipAddresses');
  });

  it('builds section summary with failure markers', () => {
    const summary = buildSystemSectionSummary({
      components: [{ label: 'CPU', temperature: 50, max: null, critical: null }],
      battery: null,
      disks: [{ name: 'Disk', mountPoint: '/', totalSpace: 1, availableSpace: 1, usedSpace: 0, usagePercent: 0, fileSystem: 'ext4', diskType: 'ssd', isRemovable: false, isReadOnly: false, readBytes: 0, writtenBytes: 0, totalSpaceHuman: '1 B', availableSpaceHuman: '1 B', usedSpaceHuman: '0 B', readBytesHuman: '0 B', writtenBytesHuman: '0 B' }],
      networks: [],
      subsystemErrors: ['networks', 'cache'],
    } as never);

    expect(summary.components).toMatchObject({ status: 'ok', itemCount: 1 });
    expect(summary.networks).toMatchObject({ status: 'failed', itemCount: 0 });
    expect(summary.cache).toMatchObject({ status: 'failed' });
  });

  it('builds web diagnostics report with normalized update and redacted network data', () => {
    const report = buildWebDiagnosticsReport({
      generatedAt: '2026-03-05T00:00:00.000Z',
      updateInfo: {
        current_version: '1.0.0',
        latest_version: '1.1.0',
        update_available: true,
        release_notes: 'notes',
      },
      updateStatus: 'error',
      updateErrorCategory: 'network_error',
      updateErrorMessage: 'network down',
      systemInfo: {
        os: 'windows',
        osLongVersion: 'Windows 11',
        hostname: 'MY-PC',
        osName: 'Windows',
        distributionId: '',
        cpuArch: 'x86_64',
        arch: 'x86_64',
        cpuModel: 'Intel',
        cpuVendorId: 'GenuineIntel',
        cpuFrequency: 3600,
        cpuCores: 8,
        totalMemory: 16 * 1024 * 1024 * 1024,
        availableMemory: 8 * 1024 * 1024 * 1024,
        usedMemory: 8 * 1024 * 1024 * 1024,
        totalSwap: 0,
        usedSwap: 0,
        uptime: 60,
        bootTime: 100,
        loadAverage: [0, 0, 0],
        subsystemErrors: ['components'],
        gpus: [],
        battery: null,
        disks: [],
        networks: [
          {
            name: 'Wi-Fi',
            macAddress: '11:22:33:44:55:66',
            ipAddresses: ['192.168.1.20'],
            totalReceived: 1,
            totalTransmitted: 2,
            totalReceivedHuman: '1 B',
            totalTransmittedHuman: '2 B',
            mtu: 1500,
            totalPacketsReceived: 3,
            totalPacketsTransmitted: 4,
            totalErrorsOnReceived: 0,
            totalErrorsOnTransmitted: 0,
          },
        ],
        osVersion: '',
        kernelVersion: '',
        appVersion: '1.0.0',
        homeDir: '/home/test',
        locale: 'en-US',
        components: [],
        physicalCoreCount: 4,
        globalCpuUsage: 10,
      } as never,
      runtime: {
        navigator: {
          userAgent: 'UA',
          language: 'en-US',
          languages: ['en-US'],
          platform: 'Win32',
          cookieEnabled: true,
          onLine: true,
          hardwareConcurrency: 8,
          deviceMemory: null,
          maxTouchPoints: 0,
        },
        screen: {
          width: 1920,
          height: 1080,
          colorDepth: 24,
          pixelRatio: 1,
        },
        performance: {
          memory: null,
          timing: null,
        },
      },
    });

    expect(report.generated).toBe('2026-03-05T00:00:00.000Z');
    expect(report.appVersion).toBe('9.9.9-test');
    expect(report.update).toMatchObject({
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      status: 'error',
      errorCategory: 'network_error',
    });
    expect(report.system).toMatchObject({
      hostnameRedacted: 'MY***',
    });
    expect((report.system as Record<string, unknown>).sectionSummary).toBeTruthy();

    const networks = (report.system as Record<string, unknown>)
      .networks as Array<Record<string, unknown>>;
    expect(networks[0].ipAddressesRedacted).toEqual(['192.168.1.*']);
    expect(networks[0].macAddressRedacted).toBe('112233******');
    expect(networks[0]).not.toHaveProperty('macAddress');
  });
});


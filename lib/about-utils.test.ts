import { buildSystemInfoText } from './about-utils';

jest.mock('@/lib/app-version', () => ({ APP_VERSION: '1.0.0-test' }));

const mockT = (key: string) => key;

describe('buildSystemInfoText', () => {
  const baseDisplay = {
    osDisplayName: 'Windows 11 Pro',
    cpuCoresDisplay: '8',
    memoryDisplay: '16 GB',
    swapDisplay: '4 GB',
    gpuDisplay: 'NVIDIA RTX 4090',
  };

  it('builds full system info text with all fields', () => {
    const result = buildSystemInfoText({
      systemInfo: {
        appVersion: '2.0.0',
        cpuArch: 'x86_64',
        arch: 'x64',
        kernelVersion: '10.0.22631',
        hostname: 'MY-PC',
        cpuModel: 'AMD Ryzen 9',
        cpuFrequency: 4500,
        uptime: 3600,
        homeDir: 'C:\\Users\\test',
        locale: 'zh-CN',
      } as never,
      updateInfo: { current_version: '2.1.0' } as never,
      display: baseDisplay,
      unknownText: 'N/A',
      t: mockT,
    });

    expect(result).toContain('2.1.0');
    expect(result).toContain('Windows 11 Pro');
    expect(result).toContain('x86_64');
    expect(result).toContain('10.0.22631');
    expect(result).toContain('MY-PC');
    expect(result).toContain('AMD Ryzen 9');
    expect(result).toContain('4500 MHz');
    expect(result).toContain('16 GB');
    expect(result).toContain('4 GB');
    expect(result).toContain('NVIDIA RTX 4090');
    expect(result).toContain('C:\\Users\\test');
    expect(result).toContain('zh-CN');
  });

  it('uses updateInfo.current_version over systemInfo.appVersion', () => {
    const result = buildSystemInfoText({
      systemInfo: { appVersion: '2.0.0' } as never,
      updateInfo: { current_version: '2.1.0' } as never,
      display: baseDisplay,
      unknownText: 'N/A',
      t: mockT,
    });
    expect(result).toContain('v2.1.0');
    expect(result).not.toContain('v2.0.0');
  });

  it('falls back to systemInfo.appVersion when updateInfo is null', () => {
    const result = buildSystemInfoText({
      systemInfo: { appVersion: '2.0.0' } as never,
      updateInfo: null,
      display: baseDisplay,
      unknownText: 'N/A',
      t: mockT,
    });
    expect(result).toContain('v2.0.0');
  });

  it('falls back to APP_VERSION when both are missing', () => {
    const result = buildSystemInfoText({
      systemInfo: null,
      updateInfo: null,
      display: { osDisplayName: '', cpuCoresDisplay: '', memoryDisplay: '', swapDisplay: '', gpuDisplay: '' },
      unknownText: 'N/A',
      t: mockT,
    });
    expect(result).toContain('v1.0.0-test');
  });

  it('uses unknownText for missing systemInfo fields', () => {
    const result = buildSystemInfoText({
      systemInfo: null,
      updateInfo: null,
      display: { osDisplayName: '', cpuCoresDisplay: '', memoryDisplay: '', swapDisplay: '', gpuDisplay: '' },
      unknownText: 'Unknown',
      t: mockT,
    });
    expect(result).toContain('Unknown');
  });

  it('uses default homeDir and locale when not provided', () => {
    const result = buildSystemInfoText({
      systemInfo: {} as never,
      updateInfo: null,
      display: baseDisplay,
      unknownText: 'N/A',
      t: mockT,
    });
    expect(result).toContain('~/.cognia');
    expect(result).toContain('en-US');
  });

  it("includes about insights fields when provided", () => {
    const result = buildSystemInfoText({
      systemInfo: { appVersion: "2.0.0" } as never,
      aboutInsights: {
        runtimeMode: "desktop",
        providerSummary: {
          total: 4,
          installed: 3,
          supported: 3,
          unsupported: 1,
        },
        storageSummary: {
          cacheTotalSizeHuman: "8.0 MB",
          logTotalSizeBytes: 1024,
          logTotalSizeHuman: "1.0 KB",
        },
        sections: {
          providers: "ok",
          logs: "ok",
          cache: "failed",
        },
        generatedAt: "2026-03-08T00:00:00.000Z",
      },
      updateInfo: null,
      display: baseDisplay,
      unknownText: "N/A",
      t: mockT,
    });

    expect(result).toContain("about.insightsTitle");
    expect(result).toContain("desktop");
    expect(result).toContain("3/4");
    expect(result).toContain("8.0 MB");
    expect(result).toContain("providers=ok");
    expect(result).toContain("cache=failed");
  });

  it("includes gpu, thermal, battery, disk, network, subsystem, and byte-fallback insight sections", () => {
    const result = buildSystemInfoText({
      systemInfo: {
        appVersion: '2.0.0',
        cpuArch: 'x86_64',
        arch: 'x64',
        kernelVersion: '6.8.0',
        hostname: 'DESKTOP',
        cpuModel: 'Ryzen',
        cpuCores: 8,
        cpuFrequency: 4200,
        cpuVendorId: 'AMD',
        totalMemory: 16 * 1024 * 1024 * 1024,
        availableMemory: 6 * 1024 * 1024 * 1024,
        usedMemory: 10 * 1024 * 1024 * 1024,
        totalSwap: 4 * 1024 * 1024 * 1024,
        usedSwap: 1 * 1024 * 1024 * 1024,
        uptime: 3661,
        bootTime: 100,
        distributionId: 'ubuntu',
        osName: 'Linux',
        homeDir: '/home/tester',
        cacheTotalSizeHuman: '20 MB',
        cacheInternalSizeHuman: '12 MB',
        cacheExternalSizeHuman: '8 MB',
        locale: 'ja-JP',
        loadAverage: [0.5, 0.25, 0.1],
        globalCpuUsage: 55.5,
        gpus: [{ name: 'GPU 1', vramMb: 4096, driverVersion: '1.2.3', vendor: 'VendorX' }],
        components: [{ label: 'CPU', temperature: 65.2, max: 80.1, critical: 95.4 }],
        battery: {
          percent: 77,
          powerSource: 'Battery',
          isCharging: false,
          isPluggedIn: false,
          healthPercent: 95,
          cycleCount: 120,
          technology: 'Li-ion',
          designCapacityMwh: 50000,
          fullCapacityMwh: 47000,
          voltageMv: 12000,
          timeToEmptyMins: 180,
          timeToFullMins: null,
        },
        disks: [{
          name: 'Disk0',
          mountPoint: '/',
          fileSystem: 'ext4',
          diskType: 'ssd',
          totalSpaceHuman: '1 TB',
          availableSpaceHuman: '600 GB',
          usedSpaceHuman: '400 GB',
          usagePercent: 40,
          readBytesHuman: '1 GB',
          writtenBytesHuman: '2 GB',
          isRemovable: false,
          isReadOnly: false,
        }],
        networks: [{
          name: 'eth0',
          macAddress: 'aa:bb:cc:dd:ee:ff',
          ipAddresses: ['10.0.0.1', '10.0.0.2'],
          mtu: 1500,
          totalReceivedHuman: '10 MB',
          totalTransmittedHuman: '20 MB',
          totalPacketsReceived: 100,
          totalPacketsTransmitted: 200,
          totalErrorsOnReceived: 1,
          totalErrorsOnTransmitted: 2,
        }],
        subsystemErrors: ['cache'],
      } as never,
      aboutInsights: {
        runtimeMode: 'desktop',
        providerSummary: {
          total: 2,
          installed: 1,
          supported: 1,
          unsupported: 1,
        },
        storageSummary: {
          cacheTotalSizeHuman: '20 MB',
          logTotalSizeBytes: 2048,
          logTotalSizeHuman: null,
        },
        sections: {
          providers: 'ok',
          logs: 'failed',
          cache: 'ok',
        },
        generatedAt: '2026-03-08T00:00:00.000Z',
      },
      updateInfo: null,
      display: baseDisplay,
      unknownText: 'N/A',
      t: mockT,
    });

    expect(result).toContain('[about.gpuInfo]');
    expect(result).toContain('GPU: GPU 1');
    expect(result).toContain('[about.temperature]');
    expect(result).toContain('CPU: 65.2°C');
    expect(result).toContain('[about.battery]');
    expect(result).toContain('Charging: no');
    expect(result).toContain('[about.storage]');
    expect(result).toContain('Disk: Disk0');
    expect(result).toContain('[about.networkInfo]');
    expect(result).toContain('MAC: aa:bb:cc:dd:ee:ff');
    expect(result).toContain('Subsystem Errors: cache');
    expect(result).toContain('55.5%');
    expect(result).toContain('0.50 / 0.25 / 0.10');
    expect(result).toContain('2 KB');
  });

  it('falls back to computed memory text and null-safe component temperatures when display values are blank', () => {
    const result = buildSystemInfoText({
      systemInfo: {
        totalMemory: 8 * 1024 * 1024 * 1024,
        usedMemory: 2 * 1024 * 1024 * 1024,
        availableMemory: 6 * 1024 * 1024 * 1024,
        components: [
          { label: 'GPU', temperature: null, max: null, critical: null },
        ],
      } as never,
      updateInfo: null,
      display: {
        osDisplayName: '',
        cpuCoresDisplay: '',
        memoryDisplay: '',
        swapDisplay: '',
        gpuDisplay: '',
      },
      unknownText: 'N/A',
      t: mockT,
    });

    expect(result).toContain('2.0 GB / 8.0 GB');
    expect(result).toContain('Available Memory: 6.0 GB');
    expect(result).toContain('GPU: N/A');
    expect(result).toContain('GPU max: N/A');
    expect(result).toContain('GPU critical: N/A');
  });
});

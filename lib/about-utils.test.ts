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
});

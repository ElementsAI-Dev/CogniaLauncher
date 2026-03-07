import { renderHook } from '@testing-library/react';
import { useSystemInfoDisplay } from './use-system-info-display';

describe('useSystemInfoDisplay', () => {
  it('formats main display fields', () => {
    const { result } = renderHook(() =>
      useSystemInfoDisplay({
        os: 'Windows',
        osVersion: '11',
        osLongVersion: '',
        usedMemory: 8 * 1024 * 1024 * 1024,
        totalMemory: 16 * 1024 * 1024 * 1024,
        usedSwap: 512 * 1024 * 1024,
        totalSwap: 2 * 1024 * 1024 * 1024,
        cpuCores: 16,
        physicalCoreCount: 8,
        gpus: [{ name: 'NVIDIA RTX', vramMb: 12288 }],
      } as never),
    );

    expect(result.current.osDisplayName).toBe('Windows 11');
    expect(result.current.memoryPercent).toBe(50);
    expect(result.current.swapPercent).toBe(25);
    expect(result.current.cpuCoresDisplay).toBe('8P / 16L');
    expect(result.current.gpuDisplay).toContain('NVIDIA RTX');
  });

  it('returns safe defaults for null/zero values', () => {
    const { result } = renderHook(() => useSystemInfoDisplay(null));
    expect(result.current.memoryPercent).toBe(0);
    expect(result.current.swapPercent).toBe(0);
    expect(result.current.memoryDisplay).toBeUndefined();
  });
});


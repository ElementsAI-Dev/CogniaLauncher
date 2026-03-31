import { act, renderHook } from '@testing-library/react';
import { useBrew } from './use-brew';

const mockIsTauri = jest.fn(() => true);
const mockBrewListTaps = jest.fn();
const mockBrewAddTap = jest.fn();
const mockBrewRemoveTap = jest.fn();
const mockBrewListServices = jest.fn();
const mockBrewServiceStart = jest.fn();
const mockBrewServiceStop = jest.fn();
const mockBrewServiceRestart = jest.fn();
const mockBrewCleanup = jest.fn();
const mockBrewDoctor = jest.fn();
const mockBrewAutoremove = jest.fn();
const mockBrewListPinned = jest.fn();
const mockBrewPin = jest.fn();
const mockBrewUnpin = jest.fn();
const mockBrewGetConfig = jest.fn();
const mockBrewAnalyticsStatus = jest.fn();
const mockBrewAnalyticsToggle = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/tauri', () => ({
  brewListTaps: (...args: unknown[]) => mockBrewListTaps(...args),
  brewAddTap: (...args: unknown[]) => mockBrewAddTap(...args),
  brewRemoveTap: (...args: unknown[]) => mockBrewRemoveTap(...args),
  brewListServices: (...args: unknown[]) => mockBrewListServices(...args),
  brewServiceStart: (...args: unknown[]) => mockBrewServiceStart(...args),
  brewServiceStop: (...args: unknown[]) => mockBrewServiceStop(...args),
  brewServiceRestart: (...args: unknown[]) => mockBrewServiceRestart(...args),
  brewCleanup: (...args: unknown[]) => mockBrewCleanup(...args),
  brewDoctor: (...args: unknown[]) => mockBrewDoctor(...args),
  brewAutoremove: (...args: unknown[]) => mockBrewAutoremove(...args),
  brewListPinned: (...args: unknown[]) => mockBrewListPinned(...args),
  brewPin: (...args: unknown[]) => mockBrewPin(...args),
  brewUnpin: (...args: unknown[]) => mockBrewUnpin(...args),
  brewGetConfig: (...args: unknown[]) => mockBrewGetConfig(...args),
  brewAnalyticsStatus: (...args: unknown[]) => mockBrewAnalyticsStatus(...args),
  brewAnalyticsToggle: (...args: unknown[]) => mockBrewAnalyticsToggle(...args),
}));

describe('useBrew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrewListTaps.mockResolvedValue([{ name: 'homebrew/core' }]);
    mockBrewListServices.mockResolvedValue([{ name: 'redis' }]);
    mockBrewListPinned.mockResolvedValue([{ name: 'node' }]);
    mockBrewGetConfig.mockResolvedValue({ homebrewPrefix: '/opt/homebrew' });
    mockBrewAnalyticsStatus.mockResolvedValue(true);
    mockBrewAutoremove.mockResolvedValue(['pkg1']);
    mockBrewDoctor.mockResolvedValue({ warnings: [] });
    mockBrewCleanup.mockResolvedValue({ reclaimedHuman: '100 MB' });
  });

  it('fetches taps and updates state', async () => {
    const { result } = renderHook(() => useBrew());
    await act(async () => {
      await result.current.fetchTaps();
    });
    expect(result.current.taps).toEqual([{ name: 'homebrew/core' }]);
  });

  it('captures errors from backend calls', async () => {
    mockBrewListTaps.mockRejectedValue(new Error('brew missing'));
    const { result } = renderHook(() => useBrew());
    await act(async () => {
      try {
        await result.current.fetchTaps();
      } catch {
        // expected
      }
    });
    expect(result.current.error).toBe('brew missing');
    expect(result.current.loading).toBe(false);
  });
});

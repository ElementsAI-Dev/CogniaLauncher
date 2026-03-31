import { act, renderHook } from '@testing-library/react';
import { useMacPorts } from './use-macports';

const mockIsTauri = jest.fn(() => true);
const mockListVariants = jest.fn();
const mockPortContents = jest.fn();
const mockPortDependents = jest.fn();
const mockPortClean = jest.fn();
const mockCleanAll = jest.fn();
const mockSelfupdate = jest.fn();
const mockListSelectGroups = jest.fn();
const mockSelectOptions = jest.fn();
const mockSelectSet = jest.fn();
const mockReclaim = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/tauri', () => ({
  macportsListVariants: (...args: unknown[]) => mockListVariants(...args),
  macportsPortContents: (...args: unknown[]) => mockPortContents(...args),
  macportsPortDependents: (...args: unknown[]) => mockPortDependents(...args),
  macportsPortClean: (...args: unknown[]) => mockPortClean(...args),
  macportsCleanAll: (...args: unknown[]) => mockCleanAll(...args),
  macportsSelfupdate: (...args: unknown[]) => mockSelfupdate(...args),
  macportsListSelectGroups: (...args: unknown[]) => mockListSelectGroups(...args),
  macportsSelectOptions: (...args: unknown[]) => mockSelectOptions(...args),
  macportsSelectSet: (...args: unknown[]) => mockSelectSet(...args),
  macportsReclaim: (...args: unknown[]) => mockReclaim(...args),
}));

describe('useMacPorts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListVariants.mockResolvedValue([{ name: '+universal', enabled: true }]);
    mockListSelectGroups.mockResolvedValue([{ group: 'python', selected: 'python312' }]);
    mockSelectOptions.mockResolvedValue({ group: 'python', options: ['python311', 'python312'] });
  });

  it('loads variants and select groups', async () => {
    const { result } = renderHook(() => useMacPorts());
    await act(async () => {
      await result.current.fetchVariants('wget');
      await result.current.fetchSelectGroups();
    });
    expect(result.current.variants).toEqual([{ name: '+universal', enabled: true }]);
    expect(result.current.selectGroups).toEqual([
      { group: 'python', selected: 'python312' },
    ]);
  });

  it('sets error when action fails', async () => {
    mockListVariants.mockRejectedValue(new Error('no macports'));
    const { result } = renderHook(() => useMacPorts());
    await act(async () => {
      try {
        await result.current.fetchVariants('wget');
      } catch {
        // expected
      }
    });
    expect(result.current.error).toBe('no macports');
  });
});

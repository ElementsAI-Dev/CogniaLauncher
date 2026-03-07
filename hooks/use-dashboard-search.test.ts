import { act, renderHook } from '@testing-library/react';
import { useDashboardSearch } from './use-dashboard-search';

const mockPush = jest.fn();
const mockGetSearchHistory = jest.fn(() => ['node']);
const mockSaveSearchHistory = jest.fn((prev: string[], q: string) => [q, ...prev]);
const mockClearSearchHistory = jest.fn();
const mockGetToolboxDetailPath = jest.fn((id: string) => `/toolbox/${id}`);
const mockUseToolbox = jest.fn(() => ({
  allTools: [
    {
      id: 'builtin:proxy',
      name: 'Proxy Checker',
      description: 'Check proxy',
      keywords: ['proxy', 'network'],
    },
  ],
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (k: string) => k }),
}));

jest.mock('@/lib/dashboard-utils', () => ({
  getSearchHistory: () => mockGetSearchHistory(),
  saveSearchHistory: (...args: unknown[]) => mockSaveSearchHistory(...args),
  clearSearchHistory: (...args: unknown[]) => mockClearSearchHistory(...args),
}));

jest.mock('@/lib/toolbox-route', () => ({
  getToolboxDetailPath: (...args: unknown[]) => mockGetToolboxDetailPath(...args),
}));

jest.mock('@/hooks/use-toolbox', () => ({
  useToolbox: () => mockUseToolbox(),
}));

describe('useDashboardSearch', () => {
  const environments = [
    { env_type: 'node', provider: 'nvm', current_version: '22.0.0' },
  ] as never[];
  const packages = [{ name: 'pnpm', provider: 'npm', version: '9.0.0' }] as never[];
  const containerRef = { current: document.createElement('div') };
  const inputRef = { current: document.createElement('input') };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns filtered env/package/tool results from query', () => {
    const { result } = renderHook(() =>
      useDashboardSearch({ environments, packages, containerRef, inputRef }),
    );

    act(() => {
      result.current.setOpen(true);
      result.current.setQuery('pro');
    });

    expect(result.current.toolResults).toHaveLength(1);
    expect(result.current.hasResults).toBe(true);
    expect(result.current.showDropdown).toBe(true);
  });

  it('saves history and routes when selecting result', () => {
    const { result } = renderHook(() =>
      useDashboardSearch({ environments, packages, containerRef, inputRef }),
    );
    act(() => {
      result.current.setQuery('proxy');
    });

    act(() => {
      result.current.handleSelect({
        id: 'action',
        type: 'action',
        title: 'Open',
        href: '/settings',
      });
    });

    expect(mockSaveSearchHistory).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/settings');
    expect(result.current.query).toBe('');
    expect(result.current.open).toBe(false);
  });
});


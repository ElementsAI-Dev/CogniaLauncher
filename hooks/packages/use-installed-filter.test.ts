import { act, renderHook } from '@testing-library/react';
import { useInstalledFilter } from './use-installed-filter';

describe('useInstalledFilter', () => {
  const packages = [
    { name: 'Node.js', version: '22.1.0', provider: 'node' },
    { name: 'Python', version: '3.12.0', provider: 'python' },
    { name: 'pnpm', version: '9.0.0', provider: 'node' },
  ] as never[];

  it('filters by provider and query', () => {
    const { result } = renderHook(() => useInstalledFilter(packages));

    act(() => {
      result.current.setFilter({ provider: 'node', query: 'pnpm' });
    });

    expect(result.current.filteredPackages).toHaveLength(1);
    expect(result.current.filteredPackages[0].name).toBe('pnpm');
  });

  it('returns all packages when query/provider are empty', () => {
    const { result } = renderHook(() => useInstalledFilter(packages));
    expect(result.current.filteredPackages).toHaveLength(3);
  });
});


import { act, renderHook, waitFor } from '@testing-library/react';
import {
  buildFilterQuery,
  buildProviderDetailHref,
  parseEnumParam,
  parseFiltersFromParams,
  useProviderFilters,
} from './use-provider-filters';

describe('useProviderFilters helpers', () => {
  it('parses enum params with a fallback when the value is invalid', () => {
    expect(parseEnumParam('linux', ['windows', 'linux'] as const, 'windows')).toBe(
      'linux',
    );
    expect(parseEnumParam('darwin', ['windows', 'linux'] as const, 'windows')).toBe(
      'windows',
    );
    expect(parseEnumParam(null, ['windows', 'linux'] as const, 'windows')).toBe(
      'windows',
    );
  });

  it('parses and serializes provider filter params consistently', () => {
    const searchParams = new URLSearchParams(
      'search= rust &category=environment&status=available&platform=linux&sort=status&view=list',
    );

    expect(parseFiltersFromParams(searchParams)).toEqual({
      searchQuery: ' rust ',
      categoryFilter: 'environment',
      statusFilter: 'available',
      platformFilter: 'linux',
      sortOption: 'status',
      viewMode: 'list',
    });

    expect(
      buildFilterQuery({
        searchQuery: ' rust ',
        categoryFilter: 'environment',
        statusFilter: 'available',
        platformFilter: 'linux',
        sortOption: 'status',
        viewMode: 'list',
      }),
    ).toBe(
      'search=rust&category=environment&status=available&platform=linux&sort=status&view=list',
    );

    expect(buildProviderDetailHref('npm', '/providers?search=rust')).toBe(
      '/providers/npm?from=%2Fproviders%3Fsearch%3Drust',
    );
  });
});

describe('useProviderFilters', () => {
  it('initializes from the current URL and syncs later local changes back into replaceUrl', async () => {
    const replaceUrl = jest.fn();
    const { result, rerender } = renderHook(
      ({ searchParams }) =>
        useProviderFilters({
          pathname: '/providers',
          searchParams,
          replaceUrl,
        }),
      {
        initialProps: {
          searchParams: new URLSearchParams(
            'search=rust&category=environment&status=available&platform=linux&sort=status&view=list',
          ),
        },
      },
    );

    expect(result.current.searchQuery).toBe('rust');
    expect(result.current.categoryFilter).toBe('environment');
    expect(result.current.statusFilter).toBe('available');
    expect(result.current.platformFilter).toBe('linux');
    expect(result.current.sortOption).toBe('status');
    expect(result.current.viewMode).toBe('list');
    expect(result.current.providersHref).toBe(
      '/providers?search=rust&category=environment&status=available&platform=linux&sort=status&view=list',
    );
    expect(result.current.buildDetailHref('npm')).toBe(
      '/providers/npm?from=%2Fproviders%3Fsearch%3Drust%26category%3Denvironment%26status%3Davailable%26platform%3Dlinux%26sort%3Dstatus%26view%3Dlist',
    );

    await act(async () => {
      result.current.setSearchQuery('node');
    });

    await waitFor(() => {
      expect(replaceUrl).toHaveBeenLastCalledWith(
        '/providers?search=node&category=environment&status=available&platform=linux&sort=status&view=list',
        { scroll: false },
      );
    });

    rerender({
      searchParams: new URLSearchParams(
        'search=node&category=environment&status=available&platform=linux&sort=status&view=list',
      ),
    });

    await act(async () => {
      result.current.setCategoryFilter('package');
    });

    await waitFor(() => {
      expect(replaceUrl).toHaveBeenLastCalledWith(
        '/providers?search=node&category=package&status=available&platform=linux&sort=status&view=list',
        { scroll: false },
      );
    });
  });

  it('clears active filters back to defaults and drops filter query state', async () => {
    const replaceUrl = jest.fn();
    const searchParams = new URLSearchParams(
      'search=rust&category=environment&status=available&platform=linux',
    );

    const { result, rerender } = renderHook(
      ({ searchParams }) =>
        useProviderFilters({
          pathname: '/providers',
          searchParams,
          replaceUrl,
        }),
      {
        initialProps: {
          searchParams,
        },
      },
    );

    expect(result.current.hasFilters).toBe(true);

    await act(async () => {
      result.current.clearFilters();
    });

    expect(replaceUrl).toHaveBeenLastCalledWith('/providers', { scroll: false });

    rerender({
      searchParams: new URLSearchParams(''),
    });

    await waitFor(() => {
      expect(result.current.hasFilters).toBe(false);
      expect(result.current.providersHref).toBe('/providers');
    });
  });

  it('re-syncs local state when the URL params change from outside the hook', async () => {
    const replaceUrl = jest.fn();

    const { result, rerender } = renderHook(
      ({ pathname, searchParams }) =>
        useProviderFilters({
          pathname,
          searchParams,
          replaceUrl,
        }),
      {
        initialProps: {
          pathname: '/providers',
          searchParams: new URLSearchParams(''),
        },
      },
    );

    expect(result.current.searchQuery).toBe('');
    expect(result.current.viewMode).toBe('grid');

    rerender({
      pathname: '/providers',
      searchParams: new URLSearchParams('search=go&view=list'),
    });

    await waitFor(() => {
      expect(result.current.searchQuery).toBe('go');
      expect(result.current.viewMode).toBe('list');
      expect(result.current.providersHref).toBe('/providers?search=go&view=list');
    });
  });
});

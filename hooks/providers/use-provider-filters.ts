'use client';

import { useMemo, useCallback, useEffect, useReducer } from 'react';
import type {
  CategoryFilter,
  StatusFilter,
  SortOption,
  ViewMode,
  PlatformFilter,
} from '@/types/provider';

// ─── Constants ────────────────────────────────────────────────────────

const CATEGORY_FILTER_VALUES = ['all', 'environment', 'package', 'system'] as const;
const STATUS_FILTER_VALUES = ['all', 'available', 'unavailable', 'enabled', 'disabled'] as const;
const PLATFORM_FILTER_VALUES = ['all', 'windows', 'linux', 'macos'] as const;
const SORT_OPTION_VALUES = ['name-asc', 'name-desc', 'priority-asc', 'priority-desc', 'status'] as const;
const VIEW_MODE_VALUES = ['grid', 'list'] as const;

interface ProviderFilterState {
  searchQuery: string;
  categoryFilter: CategoryFilter;
  statusFilter: StatusFilter;
  platformFilter: PlatformFilter;
  sortOption: SortOption;
  viewMode: ViewMode;
}

const DEFAULTS: ProviderFilterState = {
  searchQuery: '',
  categoryFilter: 'all',
  statusFilter: 'all',
  platformFilter: 'all',
  sortOption: 'name-asc',
  viewMode: 'grid',
};

type ProviderFilterAction =
  | { type: 'sync_from_url'; payload: ProviderFilterState }
  | { type: 'set_search'; payload: string }
  | { type: 'set_category'; payload: CategoryFilter }
  | { type: 'set_status'; payload: StatusFilter }
  | { type: 'set_platform'; payload: PlatformFilter }
  | { type: 'set_sort'; payload: SortOption }
  | { type: 'set_view'; payload: ViewMode }
  | { type: 'clear_filters' };

function sameFilterState(a: ProviderFilterState, b: ProviderFilterState): boolean {
  return (
    a.searchQuery === b.searchQuery &&
    a.categoryFilter === b.categoryFilter &&
    a.statusFilter === b.statusFilter &&
    a.platformFilter === b.platformFilter &&
    a.sortOption === b.sortOption &&
    a.viewMode === b.viewMode
  );
}

function providerFilterReducer(
  state: ProviderFilterState,
  action: ProviderFilterAction,
): ProviderFilterState {
  switch (action.type) {
    case 'sync_from_url':
      return sameFilterState(state, action.payload) ? state : action.payload;
    case 'set_search':
      return state.searchQuery === action.payload
        ? state
        : { ...state, searchQuery: action.payload };
    case 'set_category':
      return state.categoryFilter === action.payload
        ? state
        : { ...state, categoryFilter: action.payload };
    case 'set_status':
      return state.statusFilter === action.payload
        ? state
        : { ...state, statusFilter: action.payload };
    case 'set_platform':
      return state.platformFilter === action.payload
        ? state
        : { ...state, platformFilter: action.payload };
    case 'set_sort':
      return state.sortOption === action.payload
        ? state
        : { ...state, sortOption: action.payload };
    case 'set_view':
      return state.viewMode === action.payload
        ? state
        : { ...state, viewMode: action.payload };
    case 'clear_filters': {
      const nextState = {
        ...state,
        searchQuery: DEFAULTS.searchQuery,
        categoryFilter: DEFAULTS.categoryFilter,
        statusFilter: DEFAULTS.statusFilter,
        platformFilter: DEFAULTS.platformFilter,
      };
      return sameFilterState(state, nextState) ? state : nextState;
    }
    default:
      return state;
  }
}

// ─── Pure helpers (exported for testing) ──────────────────────────────

export function parseEnumParam<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
  fallback: T,
): T {
  return value && allowedValues.includes(value as T) ? (value as T) : fallback;
}

export function parseFiltersFromParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): ProviderFilterState {
  return {
    searchQuery: searchParams.get('search') ?? DEFAULTS.searchQuery,
    categoryFilter: parseEnumParam(
      searchParams.get('category'),
      CATEGORY_FILTER_VALUES,
      DEFAULTS.categoryFilter,
    ),
    statusFilter: parseEnumParam(
      searchParams.get('status'),
      STATUS_FILTER_VALUES,
      DEFAULTS.statusFilter,
    ),
    platformFilter: parseEnumParam(
      searchParams.get('platform'),
      PLATFORM_FILTER_VALUES,
      DEFAULTS.platformFilter,
    ),
    sortOption: parseEnumParam(
      searchParams.get('sort'),
      SORT_OPTION_VALUES,
      DEFAULTS.sortOption,
    ),
    viewMode: parseEnumParam(
      searchParams.get('view'),
      VIEW_MODE_VALUES,
      DEFAULTS.viewMode,
    ),
  };
}

export function buildFilterQuery(state: ProviderFilterState): string {
  const params = new URLSearchParams();
  const trimmedSearch = state.searchQuery.trim();

  if (trimmedSearch) params.set('search', trimmedSearch);
  if (state.categoryFilter !== DEFAULTS.categoryFilter) params.set('category', state.categoryFilter);
  if (state.statusFilter !== DEFAULTS.statusFilter) params.set('status', state.statusFilter);
  if (state.platformFilter !== DEFAULTS.platformFilter) params.set('platform', state.platformFilter);
  if (state.sortOption !== DEFAULTS.sortOption) params.set('sort', state.sortOption);
  if (state.viewMode !== DEFAULTS.viewMode) params.set('view', state.viewMode);

  return params.toString();
}

export function buildProviderDetailHref(providerId: string, providersHref: string): string {
  const detailPath = `/providers/${providerId}`;
  return providersHref === '/providers'
    ? detailPath
    : `${detailPath}?from=${encodeURIComponent(providersHref)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────

interface UseProviderFiltersOptions {
  pathname: string;
  searchParams: URLSearchParams;
  replaceUrl: (url: string, options?: { scroll?: boolean }) => void;
}

export function useProviderFilters({
  pathname,
  searchParams,
  replaceUrl,
}: UseProviderFiltersOptions) {
  const urlState = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams],
  );
  const searchParamString = searchParams.toString();

  const [filterState, dispatch] = useReducer(providerFilterReducer, urlState);

  useEffect(() => {
    dispatch({ type: 'sync_from_url', payload: urlState });
  }, [urlState]);

  const managementQuery = useMemo(() => buildFilterQuery(filterState), [filterState]);

  const providersHref = useMemo(
    () => (managementQuery ? `${pathname}?${managementQuery}` : pathname),
    [pathname, managementQuery],
  );

  useEffect(() => {
    if (managementQuery === searchParamString) return;
    replaceUrl(
      managementQuery ? `${pathname}?${managementQuery}` : pathname,
      { scroll: false },
    );
  }, [managementQuery, pathname, replaceUrl, searchParamString]);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'clear_filters' });
  }, []);

  const hasFilters =
    filterState.searchQuery !== '' ||
    filterState.categoryFilter !== 'all' ||
    filterState.statusFilter !== 'all' ||
    filterState.platformFilter !== 'all';

  const buildDetailHref = useCallback(
    (providerId: string) => buildProviderDetailHref(providerId, providersHref),
    [providersHref],
  );

  return {
    searchQuery: filterState.searchQuery,
    setSearchQuery: (searchQuery: string) =>
      dispatch({ type: 'set_search', payload: searchQuery }),
    categoryFilter: filterState.categoryFilter,
    setCategoryFilter: (categoryFilter: CategoryFilter) =>
      dispatch({ type: 'set_category', payload: categoryFilter }),
    statusFilter: filterState.statusFilter,
    setStatusFilter: (statusFilter: StatusFilter) =>
      dispatch({ type: 'set_status', payload: statusFilter }),
    platformFilter: filterState.platformFilter,
    setPlatformFilter: (platformFilter: PlatformFilter) =>
      dispatch({ type: 'set_platform', payload: platformFilter }),
    sortOption: filterState.sortOption,
    setSortOption: (sortOption: SortOption) =>
      dispatch({ type: 'set_sort', payload: sortOption }),
    viewMode: filterState.viewMode,
    setViewMode: (viewMode: ViewMode) =>
      dispatch({ type: 'set_view', payload: viewMode }),
    hasFilters,
    clearFilters,
    providersHref,
    buildDetailHref,
  };
}

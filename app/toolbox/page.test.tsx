import React from 'react';
import { render } from '@testing-library/react';
import ToolboxPage from './page';

let mockIsDesktop = true;
let mockFetchPlugins = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

jest.mock('@/hooks/use-plugins', () => ({
  usePlugins: () => ({
    fetchPlugins: mockFetchPlugins,
  }),
}));

jest.mock('@/hooks/use-toolbox', () => ({
  useToolbox: () => ({
    filteredTools: [],
    allTools: [],
    categoryToolCounts: {},
    totalToolCount: 0,
    dynamicCategories: [],
    isDesktop: mockIsDesktop,
    favorites: [],
    recentTools: [],
    mostUsedCount: 0,
    toolUseCounts: {},
    viewMode: 'grid',
    selectedCategory: 'all',
    searchQuery: '',
    activeToolId: null,
    toggleFavorite: jest.fn(),
    addRecent: jest.fn(),
    setViewMode: jest.fn(),
    setCategory: jest.fn(),
    setSearchQuery: jest.fn(),
    setActiveToolId: jest.fn(),
  }),
}));

jest.mock('@/components/layout/page-header', () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

jest.mock('@/components/toolbox', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const ToolSearchBar = ReactModule.forwardRef(
    (
      {
        value,
      }: {
        value: string;
      },
      ref: React.ForwardedRef<{ focus: () => void }>,
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({
        focus: () => undefined,
      }));
      return <input value={value} readOnly />;
    },
  );
  ToolSearchBar.displayName = 'ToolSearchBar';

  return {
    ToolGrid: () => <div data-testid="tool-grid" />,
    ToolCategoryNav: () => <div data-testid="category-nav" />,
    ToolSearchBar,
    ToolDetailPanel: () => <div data-testid="detail-panel" />,
    ToolEmptyState: () => <div data-testid="empty-state" />,
  };
});

jest.mock('@/components/toolbox/tool-mobile-category-nav', () => ({
  ToolMobileCategoryNav: () => <div data-testid="mobile-nav" />,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('ToolboxPage plugin bootstrap', () => {
  beforeEach(() => {
    mockIsDesktop = true;
    mockFetchPlugins = jest.fn();
    jest.clearAllMocks();
  });

  it('fetches plugins only once on desktop across rerenders', () => {
    const firstFetch = jest.fn();
    const secondFetch = jest.fn();
    mockFetchPlugins = firstFetch;

    const { rerender } = render(<ToolboxPage />);
    expect(firstFetch).toHaveBeenCalledTimes(1);

    mockFetchPlugins = secondFetch;
    rerender(<ToolboxPage />);

    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(secondFetch).not.toHaveBeenCalled();
  });

  it('does not auto-fetch plugins outside desktop mode', () => {
    mockIsDesktop = false;
    render(<ToolboxPage />);
    expect(mockFetchPlugins).not.toHaveBeenCalled();
  });
});

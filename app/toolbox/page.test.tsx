import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolboxPage from './page';

let mockIsDesktop = true;
let mockFetchPlugins = jest.fn();
const mockPush = jest.fn();
const createTool = (index: number) => ({
  id: `builtin:tool-${index}`,
  name: `Tool ${index}`,
  description: `Tool description ${index}`,
  icon: 'Wrench',
  category: 'developer',
  keywords: [],
  isBuiltIn: true,
  isNew: false,
  isBeta: false,
});
const createToolboxState = (overrides: Record<string, unknown> = {}) => ({
  filteredTools: [],
  allTools: [],
  excludedTools: [],
  categoryToolCounts: new Map<string, number>(),
  totalToolCount: 0,
  dynamicCategories: [],
  isDesktop: mockIsDesktop,
  favorites: [],
  recentTools: [],
  mostUsedCount: 0,
  toolUseCounts: {},
  assistancePanels: {
    history: { collapsed: false, hidden: false },
    featured: { collapsed: false, hidden: false },
  },
  viewMode: 'grid' as const,
  selectedCategory: 'all' as const,
  searchQuery: '',
  activeToolId: null,
  toggleFavorite: jest.fn(),
  addRecent: jest.fn(),
  setViewMode: jest.fn(),
  setCategory: jest.fn(),
  setSearchQuery: jest.fn(),
  setActiveToolId: jest.fn(),
  setAssistancePanelCollapsed: jest.fn(),
  hideAssistancePanel: jest.fn(),
  restoreAssistancePanel: jest.fn(),
  restoreAllAssistancePanels: jest.fn(),
  ...overrides,
});
let mockToolboxState = createToolboxState();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

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
  useToolbox: () => mockToolboxState,
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
    ToolGrid: ({
      tools,
      onOpen,
    }: {
      tools: Array<{ id: string }>;
      onOpen: (id: string) => void;
    }) => (
      <div data-testid="tool-grid" data-tool-count={tools.length}>
        {tools.length > 0 && (
          <button
            type="button"
            data-testid="open-first-tool"
            onClick={() => onOpen(tools[0].id)}
          >
            open first tool
          </button>
        )}
      </div>
    ),
    ToolCategoryNav: () => <div data-testid="category-nav" />,
    ToolSearchBar,
    ToolDetailPanel: () => <div data-testid="detail-panel" />,
    ToolEmptyState: ({ type }: { type: string }) => (
      <div data-testid="empty-state" data-empty-type={type} />
    ),
  };
});

jest.mock('@/components/toolbox/tool-mobile-category-nav', () => ({
  ToolMobileCategoryNav: () => <div data-testid="mobile-nav" />,
}));

jest.mock('@/components/toolbox/toolbox-assistance', () => ({
  ToolboxAssistance: () => <div data-testid="toolbox-assistance-component" />,
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
    mockToolboxState = createToolboxState();
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
    mockToolboxState = createToolboxState({ isDesktop: false });
    render(<ToolboxPage />);
    expect(mockFetchPlugins).not.toHaveBeenCalled();
  });

  it('keeps page container non-scrollable and list container scrollable', () => {
    render(<ToolboxPage />);

    const pageRoot = screen.getByTestId('toolbox-page-root');
    const contentShell = screen.getByTestId('toolbox-content-shell');
    const listScrollArea = screen.getByTestId('toolbox-list-scroll-area');

    expect(pageRoot.className).toContain('h-full');
    expect(pageRoot.className).toContain('overflow-hidden');
    expect(pageRoot.className).not.toContain('overflow-y-auto');

    expect(contentShell.className).toContain('min-h-0');
    expect(contentShell.className).toContain('overflow-hidden');

    expect(listScrollArea.className).toContain('min-h-0');
    expect(listScrollArea.className).toContain('overflow-y-auto');
  });

  it('uses dense toolbar clusters for header actions to keep controls aligned', () => {
    render(<ToolboxPage />);

    const headerToolbar = screen.getByTestId('toolbox-header-toolbar');
    const marketGroup = screen.getByTestId('toolbox-header-market-group');
    const pluginsGroup = screen.getByTestId('toolbox-header-plugins-group');
    const viewGroup = screen.getByTestId('toolbox-header-view-group');
    const gridToggle = screen.getByLabelText('toolbox.viewMode.grid');
    const listToggle = screen.getByLabelText('toolbox.viewMode.list');

    expect(headerToolbar.className).toContain('flex-wrap');
    expect(marketGroup).toHaveAttribute('data-slot', 'toolbar-cluster');
    expect(pluginsGroup).toHaveAttribute('data-slot', 'toolbar-cluster');
    expect(viewGroup).toHaveAttribute('data-slot', 'toolbar-cluster');
    expect(gridToggle.className).toContain('h-9');
    expect(gridToggle.className).toContain('w-9');
    expect(listToggle.className).toContain('h-9');
    expect(listToggle.className).toContain('w-9');
  });

  it('keeps empty state reachable inside the list scroll area', () => {
    mockToolboxState = createToolboxState({ selectedCategory: 'favorites' });
    render(<ToolboxPage />);

    const listScrollArea = screen.getByTestId('toolbox-list-scroll-area');
    const emptyState = screen.getByTestId('empty-state');

    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveAttribute('data-empty-type', 'no-favorites');
    expect(listScrollArea).toContainElement(emptyState);
  });

  it('keeps long tool lists inside the dedicated list scroll area', () => {
    const manyTools = Array.from({ length: 120 }, (_, index) => createTool(index + 1));
    mockToolboxState = createToolboxState({
      filteredTools: manyTools,
      allTools: manyTools,
      totalToolCount: manyTools.length,
      categoryToolCounts: new Map([['developer', manyTools.length]]),
    });

    render(<ToolboxPage />);

    const listScrollArea = screen.getByTestId('toolbox-list-scroll-area');
    const toolGrid = screen.getByTestId('tool-grid');

    expect(toolGrid).toHaveAttribute('data-tool-count', String(manyTools.length));
    expect(listScrollArea.className).toContain('overflow-y-auto');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('navigates tool open action to static-export-safe toolbox detail route', () => {
    const addRecent = jest.fn();
    mockToolboxState = createToolboxState({
      filteredTools: [createTool(1)],
      allTools: [createTool(1)],
      addRecent,
    });
    render(<ToolboxPage />);

    fireEvent.click(screen.getByTestId('open-first-tool'));

    expect(mockPush).toHaveBeenCalledWith('/toolbox/tool?id=builtin%3Atool-1');
    expect(addRecent).not.toHaveBeenCalled();
  });

  it('renders page-level restore strip when at least one assistance panel is hidden', () => {
    const restoreAssistancePanel = jest.fn();
    const restoreAllAssistancePanels = jest.fn();
    mockToolboxState = createToolboxState({
      assistancePanels: {
        history: { collapsed: false, hidden: true },
        featured: { collapsed: false, hidden: false },
      },
      restoreAssistancePanel,
      restoreAllAssistancePanels,
    });

    render(<ToolboxPage />);

    expect(screen.getByTestId('toolbox-assistance-restore-strip')).toBeInTheDocument();
    expect(screen.getByTestId('toolbox-assistance-component')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toolbox-assistance-restore-history'));
    fireEvent.click(screen.getByTestId('toolbox-assistance-restore-all'));

    expect(restoreAssistancePanel).toHaveBeenCalledWith('history');
    expect(restoreAllAssistancePanels).toHaveBeenCalledTimes(1);
  });

  it('keeps only compact restore controls when all assistance panels are hidden', () => {
    mockToolboxState = createToolboxState({
      assistancePanels: {
        history: { collapsed: false, hidden: true },
        featured: { collapsed: false, hidden: true },
      },
    });

    render(<ToolboxPage />);

    expect(screen.getByTestId('toolbox-assistance-restore-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('toolbox-assistance-component')).not.toBeInTheDocument();
  });
});

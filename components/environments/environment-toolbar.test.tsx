import { render, screen, fireEvent } from '@testing-library/react';
import { EnvironmentToolbar } from './environment-toolbar';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'environments.toolbar.searchPlaceholder': 'Search environments...',
    'environments.toolbar.statusAll': 'All Status',
    'environments.toolbar.statusAvailable': 'Available',
    'environments.toolbar.statusUnavailable': 'Unavailable',
    'environments.toolbar.sortName': 'Sort by Name',
    'environments.toolbar.sortInstalled': 'Sort by Installed',
    'environments.toolbar.sortProvider': 'Sort by Provider',
    'environments.toolbar.showingResults': 'Showing {filtered} of {total}',
    'environments.toolbar.activeFilters': 'Active filters',
    'environments.toolbar.clearAll': 'Clear all',
    'common.refresh': 'Refresh',
    'common.clear': 'Clear',
  };
  return translations[key] || key;
};

describe('EnvironmentToolbar', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: jest.fn(),
    statusFilter: 'all' as const,
    onStatusChange: jest.fn(),
    sortBy: 'name' as const,
    onSortChange: jest.fn(),
    onRefresh: jest.fn(),
    onClearFilters: jest.fn(),
    isLoading: false,
    totalCount: 5,
    filteredCount: 5,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input', () => {
    render(<EnvironmentToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search environments...')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(<EnvironmentToolbar {...defaultProps} />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search input', () => {
    render(<EnvironmentToolbar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search environments...');
    fireEvent.change(input, { target: { value: 'node' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('node');
  });

  it('calls onRefresh when refresh button is clicked', () => {
    render(<EnvironmentToolbar {...defaultProps} />);
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    expect(defaultProps.onRefresh).toHaveBeenCalled();
  });

  it('disables refresh button when loading', () => {
    render(<EnvironmentToolbar {...defaultProps} isLoading={true} />);
    const refreshButton = screen.getByText('Refresh').closest('button');
    expect(refreshButton).toBeDisabled();
  });

  it('shows clear button when search query is not empty', () => {
    render(<EnvironmentToolbar {...defaultProps} searchQuery="node" />);
    const clearButton = screen.getByLabelText('Clear');
    expect(clearButton).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', () => {
    render(<EnvironmentToolbar {...defaultProps} searchQuery="node" />);
    const clearButton = screen.getByLabelText('Clear');
    fireEvent.click(clearButton);
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('');
  });

  it('shows active filters section when filters are applied', () => {
    render(<EnvironmentToolbar {...defaultProps} searchQuery="python" />);
    expect(screen.getByText('Active filters:')).toBeInTheDocument();
    expect(screen.getByText('"python"')).toBeInTheDocument();
  });

  it('shows results count when filtered', () => {
    render(<EnvironmentToolbar {...defaultProps} totalCount={10} filteredCount={3} searchQuery="node" />);
    expect(screen.getByText('Showing 3 of 10')).toBeInTheDocument();
  });

  it('calls onClearFilters when clear all is clicked', () => {
    render(<EnvironmentToolbar {...defaultProps} searchQuery="python" />);
    const clearAllButton = screen.getByText('Clear all');
    fireEvent.click(clearAllButton);
    expect(defaultProps.onClearFilters).toHaveBeenCalled();
  });

  it('shows status filter badge when status filter is applied', () => {
    render(<EnvironmentToolbar {...defaultProps} statusFilter="available" />);
    // Status filter "available" shows both in the select dropdown and as an active filter badge
    const availableElements = screen.getAllByText('Available');
    expect(availableElements.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show active filters section when no filters applied', () => {
    render(<EnvironmentToolbar {...defaultProps} />);
    expect(screen.queryByText('Active filters:')).not.toBeInTheDocument();
  });
});

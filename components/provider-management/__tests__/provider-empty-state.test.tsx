import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderEmptyState } from '../provider-empty-state';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'providers.noProviders': 'No providers configured',
    'providers.noProvidersDesc': 'No package providers are registered in the system.',
    'providers.noResults': 'No providers match your filters',
    'providers.noResultsDesc': 'Try adjusting your search query or filters to find providers.',
    'providers.clearFilters': 'Clear Filters',
  };
  return translations[key] || key;
};

describe('ProviderEmptyState', () => {
  const mockOnClearFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no results message when filters are active', () => {
    render(
      <ProviderEmptyState
        hasFilters={true}
        onClearFilters={mockOnClearFilters}
        t={mockT}
      />
    );

    expect(screen.getByText('No providers match your filters')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search query or filters to find providers.')).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('renders no providers message when no filters are active', () => {
    render(
      <ProviderEmptyState
        hasFilters={false}
        onClearFilters={mockOnClearFilters}
        t={mockT}
      />
    );

    expect(screen.getByText('No providers configured')).toBeInTheDocument();
    expect(screen.getByText('No package providers are registered in the system.')).toBeInTheDocument();
    expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();
  });

  it('calls onClearFilters when clear filters button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProviderEmptyState
        hasFilters={true}
        onClearFilters={mockOnClearFilters}
        t={mockT}
      />
    );

    const clearButton = screen.getByText('Clear Filters');
    await user.click(clearButton);

    expect(mockOnClearFilters).toHaveBeenCalled();
  });

  it('does not show clear filters button when no filters active', () => {
    render(
      <ProviderEmptyState
        hasFilters={false}
        onClearFilters={mockOnClearFilters}
        t={mockT}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

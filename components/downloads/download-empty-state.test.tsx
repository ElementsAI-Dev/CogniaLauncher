import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadEmptyState } from './download-empty-state';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'downloads.toolbar.noResults': 'No downloads match your search',
    'downloads.toolbar.noResultsDesc': 'Try adjusting your search or filters',
    'downloads.toolbar.clearFilters': 'Clear Filters',
    'downloads.noTasks': 'No active downloads',
    'downloads.noTasksDesc': 'Downloads will appear here when you start installing packages',
  };
  return translations[key] || key;
};

describe('DownloadEmptyState', () => {
  it('renders default empty state when no filters are applied', () => {
    render(
      <DownloadEmptyState
        hasFilters={false}
        onClearFilters={jest.fn()}
        t={mockT}
      />
    );
    
    expect(screen.getByText('No active downloads')).toBeInTheDocument();
    expect(screen.getByText('Downloads will appear here when you start installing packages')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('renders filter empty state when filters are applied', () => {
    render(
      <DownloadEmptyState
        hasFilters={true}
        onClearFilters={jest.fn()}
        t={mockT}
      />
    );
    
    expect(screen.getByText('No downloads match your search')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('calls onClearFilters when clear filters button is clicked', async () => {
    const onClearFilters = jest.fn();
    render(
      <DownloadEmptyState
        hasFilters={true}
        onClearFilters={onClearFilters}
        t={mockT}
      />
    );
    
    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    
    expect(onClearFilters).toHaveBeenCalled();
  });
});

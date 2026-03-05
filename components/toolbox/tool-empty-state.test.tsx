import { render, screen } from '@testing-library/react';
import { ToolEmptyState } from './tool-empty-state';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'toolbox.empty.noResultsTitle': 'No Results',
        'toolbox.empty.noResultsDesc': 'Try a different search term',
        'toolbox.empty.noFavoritesTitle': 'No Favorites',
        'toolbox.empty.noFavoritesDesc': 'Star a tool to add it here',
        'toolbox.empty.noRecentTitle': 'No Recent Tools',
        'toolbox.empty.noRecentDesc': 'Tools you use will appear here',
      };
      return map[key] || key;
    },
  }),
}));

describe('ToolEmptyState', () => {
  it('renders no-results state', () => {
    render(<ToolEmptyState type="no-results" />);
    expect(screen.getByText('No Results')).toBeInTheDocument();
    expect(screen.getByText('Try a different search term')).toBeInTheDocument();
  });

  it('renders no-favorites state', () => {
    render(<ToolEmptyState type="no-favorites" />);
    expect(screen.getByText('No Favorites')).toBeInTheDocument();
    expect(screen.getByText('Star a tool to add it here')).toBeInTheDocument();
  });

  it('renders no-recent state', () => {
    render(<ToolEmptyState type="no-recent" />);
    expect(screen.getByText('No Recent Tools')).toBeInTheDocument();
    expect(screen.getByText('Tools you use will appear here')).toBeInTheDocument();
  });

  it('uses full-height layout classes so empty content stays reachable in scroll area', () => {
    render(<ToolEmptyState type="no-results" />);
    const wrapper = screen.getByTestId('tool-empty-state');
    expect(wrapper.className).toContain('min-h-full');
    expect(wrapper.className).toContain('justify-center');
  });
});

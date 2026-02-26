import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitSearchCommits } from './git-search-commits';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitSearchCommits', () => {
  const mockResults = [
    { hash: 'abc1234567890', parents: [], authorName: 'John', authorEmail: 'j@e.com', date: new Date().toISOString(), message: 'fix bug' },
    { hash: 'def5678901234', parents: [], authorName: 'Jane', authorEmail: 'ja@e.com', date: new Date().toISOString(), message: 'add feature' },
  ];
  const mockOnSearch = jest.fn().mockResolvedValue(mockResults);
  const mockOnSelectCommit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search title', () => {
    render(<GitSearchCommits onSearch={mockOnSearch} />);
    expect(screen.getByText('git.search.title')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<GitSearchCommits onSearch={mockOnSearch} />);
    expect(screen.getByPlaceholderText('git.search.placeholder')).toBeInTheDocument();
  });

  it('shows hint before search', () => {
    render(<GitSearchCommits onSearch={mockOnSearch} />);
    expect(screen.getByText('git.search.hint')).toBeInTheDocument();
  });

  it('calls onSearch when search button clicked', async () => {
    render(<GitSearchCommits onSearch={mockOnSearch} />);
    const input = screen.getByPlaceholderText('git.search.placeholder');
    fireEvent.change(input, { target: { value: 'bug' } });
    const searchButton = screen.getByRole('button');
    fireEvent.click(searchButton);
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('bug', 'message', 50);
    });
  });

  it('renders search results', async () => {
    render(<GitSearchCommits onSearch={mockOnSearch} onSelectCommit={mockOnSelectCommit} />);
    const input = screen.getByPlaceholderText('git.search.placeholder');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('fix bug')).toBeInTheDocument();
      expect(screen.getByText('add feature')).toBeInTheDocument();
    });
  });

  it('shows no results message', async () => {
    mockOnSearch.mockResolvedValueOnce([]);
    render(<GitSearchCommits onSearch={mockOnSearch} />);
    const input = screen.getByPlaceholderText('git.search.placeholder');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('git.search.noResults')).toBeInTheDocument();
    });
  });

  it('disables search button when input is empty', () => {
    render(<GitSearchCommits onSearch={mockOnSearch} />);
    const searchButton = screen.getByRole('button');
    expect(searchButton).toBeDisabled();
  });

  it('calls onSelectCommit when a result is clicked', async () => {
    render(<GitSearchCommits onSearch={mockOnSearch} onSelectCommit={mockOnSelectCommit} />);
    const input = screen.getByPlaceholderText('git.search.placeholder');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      fireEvent.click(screen.getByText('fix bug'));
    });
    expect(mockOnSelectCommit).toHaveBeenCalledWith('abc1234567890');
  });
});

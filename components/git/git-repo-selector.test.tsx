import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import { GitRepoSelector } from './git-repo-selector';
import { useGitRepoStore } from '@/lib/stores/git';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('GitRepoSelector', () => {
  const mockOnSelect = jest.fn().mockResolvedValue(undefined);
  const mockOnInit = jest.fn().mockResolvedValue('Initialized');

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useGitRepoStore.setState({
        recentRepos: [],
        pinnedRepos: [],
        lastRepoPath: null,
      });
    });
  });

  it('renders card with title', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByText('git.repo.selectRepo')).toBeInTheDocument();
  });

  it('renders input with placeholder', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByPlaceholderText('git.repo.pathPlaceholder')).toBeInTheDocument();
  });

  it('renders browse button', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByText('git.repo.browse')).toBeInTheDocument();
  });

  it('renders init button when onInit provided', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} onInit={mockOnInit} loading={false} />);
    expect(screen.getByText('git.actions.init')).toBeInTheDocument();
  });

  it('does not render init button when onInit not provided', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.queryByText('git.actions.init')).not.toBeInTheDocument();
  });

  it('shows initial repo path in input', () => {
    render(<GitRepoSelector repoPath="/my/repo" onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByDisplayValue('/my/repo')).toBeInTheDocument();
  });

  it('disables input when loading', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={true} />);
    expect(screen.getByPlaceholderText('git.repo.pathPlaceholder')).toBeDisabled();
  });

  it('calls onSelect when Enter is pressed with valid input', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    const input = screen.getByPlaceholderText('git.repo.pathPlaceholder');
    fireEvent.change(input, { target: { value: '/new/repo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnSelect).toHaveBeenCalledWith('/new/repo');
  });

  it('does not call onSelect when Enter is pressed with empty input', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    const input = screen.getByPlaceholderText('git.repo.pathPlaceholder');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('shows no-recent-repos message when empty', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByText('git.repo.noRecentRepos')).toBeInTheDocument();
  });

  it('renders pinned repos section when pinned repos exist', () => {
    act(() => {
      useGitRepoStore.setState({ pinnedRepos: ['/pinned/repo'] });
    });
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByText('git.repo.pinned')).toBeInTheDocument();
    expect(screen.getByText('repo')).toBeInTheDocument();
  });

  it('renders recent repos section when recent repos exist', () => {
    act(() => {
      useGitRepoStore.setState({ recentRepos: ['/recent/myproject'] });
    });
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByText('git.repo.recent')).toBeInTheDocument();
    expect(screen.getByText('myproject')).toBeInTheDocument();
  });

  it('calls onSelect when clicking a recent repo', () => {
    act(() => {
      useGitRepoStore.setState({ recentRepos: ['/recent/proj'] });
    });
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    fireEvent.click(screen.getByText('proj'));
    expect(mockOnSelect).toHaveBeenCalledWith('/recent/proj');
  });

  it('highlights active repo in recent list', () => {
    act(() => {
      useGitRepoStore.setState({ recentRepos: ['/repo/a'] });
    });
    const { container } = render(<GitRepoSelector repoPath="/repo/a" onSelect={mockOnSelect} loading={false} />);
    const activeItem = container.querySelector('.bg-accent');
    expect(activeItem).toBeInTheDocument();
  });

  it('shows clear recent button', () => {
    act(() => {
      useGitRepoStore.setState({ recentRepos: ['/repo/a'] });
    });
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByText('git.repo.clearRecent')).toBeInTheDocument();
  });

  it('clears recent repos when clear button clicked', () => {
    act(() => {
      useGitRepoStore.setState({ recentRepos: ['/repo/a', '/repo/b'] });
    });
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    fireEvent.click(screen.getByText('git.repo.clearRecent'));
    expect(useGitRepoStore.getState().recentRepos).toEqual([]);
  });
});

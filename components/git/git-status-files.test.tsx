import { render, screen, fireEvent } from '@testing-library/react';
import { GitStatusFiles } from './git-status-files';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitStatusFiles', () => {
  const files = [
    { path: 'src/main.ts', indexStatus: 'M', worktreeStatus: ' ', oldPath: null },
    { path: 'new-file.ts', indexStatus: 'A', worktreeStatus: ' ', oldPath: null },
    { path: 'modified.ts', indexStatus: ' ', worktreeStatus: 'M', oldPath: null },
    { path: 'untracked.txt', indexStatus: '?', worktreeStatus: '?', oldPath: null },
  ];

  it('renders title', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.getByText('git.status.files')).toBeInTheDocument();
  });

  it('renders file count badge', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows no changes message when empty', () => {
    render(<GitStatusFiles files={[]} />);
    expect(screen.getByText('git.status.noChanges')).toBeInTheDocument();
  });

  it('renders staged section', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.getByText(/git\.repo\.staged/)).toBeInTheDocument();
  });

  it('renders modified section', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.getByText(/git\.repo\.modified/)).toBeInTheDocument();
  });

  it('renders untracked section', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.getByText(/git\.repo\.untracked/)).toBeInTheDocument();
  });

  it('renders file paths', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    expect(screen.getByText('new-file.ts')).toBeInTheDocument();
    expect(screen.getByText('untracked.txt')).toBeInTheDocument();
  });

  it('renders status labels for staged files', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.getByText('Modified')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  it('renders refresh button when onRefresh provided', () => {
    const onRefresh = jest.fn();
    const { container } = render(<GitStatusFiles files={files} onRefresh={onRefresh} />);
    const refreshButton = container.querySelector('button');
    expect(refreshButton).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = jest.fn();
    const { container } = render(<GitStatusFiles files={files} onRefresh={onRefresh} />);
    const refreshButton = container.querySelector('button');
    if (refreshButton) fireEvent.click(refreshButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not render refresh button when onRefresh not provided', () => {
    const { container } = render(<GitStatusFiles files={files} />);
    expect(container.querySelector('button')).not.toBeInTheDocument();
  });
});

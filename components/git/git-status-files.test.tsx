import { render, screen, fireEvent } from '@testing-library/react';
import { GitStatusFiles } from './git-status-files';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
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
    render(<GitStatusFiles files={files} onRefresh={onRefresh} />);
    // refresh button is always last in the header
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = jest.fn();
    render(<GitStatusFiles files={files} onRefresh={onRefresh} />);
    // The refresh button is the last icon button
    const buttons = screen.getAllByRole('button');
    const refreshBtn = buttons[buttons.length - 1];
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders Stage All button when onStageAll provided', () => {
    const onStageAll = jest.fn().mockResolvedValue('staged');
    render(<GitStatusFiles files={files} onStageAll={onStageAll} />);
    expect(screen.getByText('git.actions.stageAll')).toBeInTheDocument();
  });

  it('does not render Stage All when onStageAll not provided', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.queryByText('git.actions.stageAll')).not.toBeInTheDocument();
  });

  it('does not render Stage All when no files', () => {
    const onStageAll = jest.fn().mockResolvedValue('staged');
    render(<GitStatusFiles files={[]} onStageAll={onStageAll} />);
    expect(screen.queryByText('git.actions.stageAll')).not.toBeInTheDocument();
  });

  it('calls onStageAll when Stage All button clicked', () => {
    const onStageAll = jest.fn().mockResolvedValue('staged');
    render(<GitStatusFiles files={files} onStageAll={onStageAll} />);
    fireEvent.click(screen.getByText('git.actions.stageAll'));
    expect(onStageAll).toHaveBeenCalled();
  });

  it('makes staged file paths clickable when onViewDiff provided', () => {
    const onViewDiff = jest.fn();
    render(<GitStatusFiles files={files} onViewDiff={onViewDiff} />);
    fireEvent.click(screen.getByText('src/main.ts'));
    expect(onViewDiff).toHaveBeenCalledWith('src/main.ts', true);
  });

  it('makes modified file paths clickable when onViewDiff provided', () => {
    const onViewDiff = jest.fn();
    render(<GitStatusFiles files={files} onViewDiff={onViewDiff} />);
    fireEvent.click(screen.getByText('modified.ts'));
    expect(onViewDiff).toHaveBeenCalledWith('modified.ts', false);
  });

  it('does not render buttons when no action props provided', () => {
    render(<GitStatusFiles files={files} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

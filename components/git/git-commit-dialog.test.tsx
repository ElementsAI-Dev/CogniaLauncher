import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitCommitDialog } from './git-commit-dialog';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitCommitDialog', () => {
  const mockOnCommit = jest.fn().mockResolvedValue('commit abc1234');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders commit title', () => {
    render(<GitCommitDialog stagedCount={0} onCommit={mockOnCommit} />);
    expect(screen.getByText('git.commit.title')).toBeInTheDocument();
  });

  it('renders commit message textarea', () => {
    render(<GitCommitDialog stagedCount={0} onCommit={mockOnCommit} />);
    expect(screen.getByPlaceholderText('git.commit.messagePlaceholder')).toBeInTheDocument();
  });

  it('shows staged count badge when files are staged', () => {
    render(<GitCommitDialog stagedCount={3} onCommit={mockOnCommit} />);
    expect(screen.getByText('3 staged')).toBeInTheDocument();
  });

  it('does not show staged count when zero', () => {
    render(<GitCommitDialog stagedCount={0} onCommit={mockOnCommit} />);
    expect(screen.queryByText('0 staged')).not.toBeInTheDocument();
  });

  it('shows no staged files message when count is 0 and not amending', () => {
    render(<GitCommitDialog stagedCount={0} onCommit={mockOnCommit} />);
    expect(screen.getByText('git.commit.noStagedFiles')).toBeInTheDocument();
  });

  it('disables commit button when no staged files and no message', () => {
    render(<GitCommitDialog stagedCount={0} onCommit={mockOnCommit} />);
    const commitButton = screen.getByRole('button', { name: /git\.actions\.commit/i });
    expect(commitButton).toBeDisabled();
  });

  it('disables commit button when staged files exist but message is empty', () => {
    render(<GitCommitDialog stagedCount={3} onCommit={mockOnCommit} />);
    const commitButton = screen.getByRole('button', { name: /git\.actions\.commit/i });
    expect(commitButton).toBeDisabled();
  });

  it('enables commit button when staged files exist and message is provided', () => {
    render(<GitCommitDialog stagedCount={3} onCommit={mockOnCommit} />);
    const textarea = screen.getByPlaceholderText('git.commit.messagePlaceholder');
    fireEvent.change(textarea, { target: { value: 'my commit' } });
    const commitButton = screen.getByRole('button', { name: /git\.actions\.commit/i });
    expect(commitButton).not.toBeDisabled();
  });

  it('calls onCommit with message when commit button is clicked', async () => {
    render(<GitCommitDialog stagedCount={3} onCommit={mockOnCommit} />);
    const textarea = screen.getByPlaceholderText('git.commit.messagePlaceholder');
    fireEvent.change(textarea, { target: { value: 'feat: add feature' } });
    const commitButton = screen.getByRole('button', { name: /git\.actions\.commit/i });
    fireEvent.click(commitButton);
    await waitFor(() => {
      expect(mockOnCommit).toHaveBeenCalledWith('feat: add feature', false);
    });
  });

  it('clears message after successful commit', async () => {
    render(<GitCommitDialog stagedCount={3} onCommit={mockOnCommit} />);
    const textarea = screen.getByPlaceholderText('git.commit.messagePlaceholder');
    fireEvent.change(textarea, { target: { value: 'some msg' } });
    fireEvent.click(screen.getByRole('button', { name: /git\.actions\.commit/i }));
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('renders amend checkbox', () => {
    render(<GitCommitDialog stagedCount={0} onCommit={mockOnCommit} />);
    expect(screen.getByText('git.commit.amend')).toBeInTheDocument();
  });

  it('disables textarea when disabled prop is true', () => {
    render(<GitCommitDialog stagedCount={3} onCommit={mockOnCommit} disabled />);
    const textarea = screen.getByPlaceholderText('git.commit.messagePlaceholder');
    expect(textarea).toBeDisabled();
  });
});

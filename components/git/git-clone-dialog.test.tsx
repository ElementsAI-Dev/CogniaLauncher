import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitCloneDialog } from './git-clone-dialog';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
  listenGitCloneProgress: jest.fn().mockResolvedValue(() => {}),
}));

jest.mock('@/lib/clipboard', () => ({
  readClipboard: jest.fn().mockResolvedValue('https://github.com/clip/repo.git'),
}));

describe('GitCloneDialog', () => {
  const mockOnClone = jest.fn().mockResolvedValue('Cloned successfully');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders clone title', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    expect(screen.getByText('git.cloneAction.title')).toBeInTheDocument();
  });

  it('renders URL input', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    expect(screen.getByPlaceholderText('git.cloneAction.urlPlaceholder')).toBeInTheDocument();
  });

  it('renders URL label', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    expect(screen.getByText('git.cloneAction.url')).toBeInTheDocument();
  });

  it('renders destination label', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    expect(screen.getByText('git.cloneAction.destination')).toBeInTheDocument();
  });

  it('disables clone button when inputs are empty', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    const cloneButton = screen.getByRole('button', { name: /git\.actions\.clone/i });
    expect(cloneButton).toBeDisabled();
  });

  it('enables clone button when both inputs have values', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    const urlInput = screen.getByPlaceholderText('git.cloneAction.urlPlaceholder');
    fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });
    const inputs = screen.getAllByRole('textbox');
    // Second textbox is destination path
    fireEvent.change(inputs[1], { target: { value: 'C:\\repos\\repo' } });
    const cloneButton = screen.getByRole('button', { name: /git\.actions\.clone/i });
    expect(cloneButton).not.toBeDisabled();
  });

  it('calls onClone with url, destPath and no options when defaults', async () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    const urlInput = screen.getByPlaceholderText('git.cloneAction.urlPlaceholder');
    fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'C:\\repos\\repo' } });
    const cloneButton = screen.getByRole('button', { name: /git\.actions\.clone/i });
    fireEvent.click(cloneButton);
    await waitFor(() => {
      expect(mockOnClone).toHaveBeenCalledWith('https://github.com/user/repo.git', 'C:\\repos\\repo', undefined);
    });
  });

  it('shows success state after clone', async () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    const urlInput = screen.getByPlaceholderText('git.cloneAction.urlPlaceholder');
    fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'C:\\repos\\repo' } });
    fireEvent.click(screen.getByRole('button', { name: /git\.actions\.clone/i }));
    await waitFor(() => {
      expect(screen.getByText('git.cloneAction.success')).toBeInTheDocument();
    });
  });

  it('shows advanced options when toggled', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    const advancedButton = screen.getByText('git.cloneAction.advancedOptions');
    expect(advancedButton).toBeInTheDocument();
    fireEvent.click(advancedButton);
    expect(screen.getByText('git.cloneAction.branch')).toBeInTheDocument();
    expect(screen.getByText('git.cloneAction.depth')).toBeInTheDocument();
    expect(screen.getByText('git.cloneAction.singleBranch')).toBeInTheDocument();
    expect(screen.getByText('git.cloneAction.recurseSubmodules')).toBeInTheDocument();
  });

  it('renders open repo button after success when onOpenRepo provided', async () => {
    const mockOpenRepo = jest.fn();
    render(<GitCloneDialog onClone={mockOnClone} onOpenRepo={mockOpenRepo} />);
    const urlInput = screen.getByPlaceholderText('git.cloneAction.urlPlaceholder');
    fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'C:\\repos\\repo' } });
    fireEvent.click(screen.getByRole('button', { name: /git\.actions\.clone/i }));
    await waitFor(() => {
      expect(screen.getByText('git.cloneAction.openCloned')).toBeInTheDocument();
    });
  });

  it('shows error message when clone fails', async () => {
    const failingClone = jest.fn().mockRejectedValue(new Error('Authentication failed'));
    render(<GitCloneDialog onClone={failingClone} />);
    const urlInput = screen.getByPlaceholderText('git.cloneAction.urlPlaceholder');
    fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'C:\\repos\\repo' } });
    fireEvent.click(screen.getByRole('button', { name: /git\.actions\.clone/i }));
    await waitFor(() => {
      expect(screen.getByText(/Authentication failed/)).toBeInTheDocument();
    });
  });

  it('renders paste URL button', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    expect(screen.getByTitle('git.cloneAction.pasteUrl')).toBeInTheDocument();
  });

  it('shows jobs and filter inputs in advanced options', () => {
    render(<GitCloneDialog onClone={mockOnClone} />);
    fireEvent.click(screen.getByText('git.cloneAction.advancedOptions'));
    expect(screen.getByText('git.cloneAction.jobs')).toBeInTheDocument();
    expect(screen.getByText('git.cloneAction.filter')).toBeInTheDocument();
    expect(screen.getByText('git.cloneAction.blobless')).toBeInTheDocument();
    expect(screen.getByText('git.cloneAction.treeless')).toBeInTheDocument();
  });

  it('renders clone history when provided', () => {
    const history = [
      { url: 'https://github.com/a/b.git', destPath: 'C:\\repos\\b', timestamp: Date.now(), status: 'success' as const },
      { url: 'https://github.com/c/d.git', destPath: 'C:\\repos\\d', timestamp: Date.now() - 100000, status: 'failed' as const, errorMessage: 'Network error' },
    ];
    render(<GitCloneDialog onClone={mockOnClone} cloneHistory={history} />);
    expect(screen.getByText(/git\.cloneAction\.recentClones/)).toBeInTheDocument();
  });

  it('does not render clone history when empty', () => {
    render(<GitCloneDialog onClone={mockOnClone} cloneHistory={[]} />);
    expect(screen.queryByText(/git\.cloneAction\.recentClones/)).not.toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { GitRepoSelector } from './git-repo-selector';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

describe('GitRepoSelector', () => {
  const mockOnSelect = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders input with placeholder', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByPlaceholderText('git.repo.selectRepo')).toBeInTheDocument();
  });

  it('renders browse button', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByText('git.repo.browse')).toBeInTheDocument();
  });

  it('shows initial repo path in input', () => {
    render(<GitRepoSelector repoPath="/my/repo" onSelect={mockOnSelect} loading={false} />);
    expect(screen.getByDisplayValue('/my/repo')).toBeInTheDocument();
  });

  it('disables input when loading', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={true} />);
    expect(screen.getByPlaceholderText('git.repo.selectRepo')).toBeDisabled();
  });

  it('disables browse button when loading', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={true} />);
    expect(screen.getByText('git.repo.browse').closest('button')).toBeDisabled();
  });

  it('calls onSelect when Enter is pressed with valid input', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    const input = screen.getByPlaceholderText('git.repo.selectRepo');
    fireEvent.change(input, { target: { value: '/new/repo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnSelect).toHaveBeenCalledWith('/new/repo');
  });

  it('does not call onSelect when Enter is pressed with empty input', () => {
    render(<GitRepoSelector repoPath={null} onSelect={mockOnSelect} loading={false} />);
    const input = screen.getByPlaceholderText('git.repo.selectRepo');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { GitCommitDetail } from './git-commit-detail';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitCommitDetail', () => {
  const mockOnClose = jest.fn();
  const detail = {
    hash: 'abc1234567890abcdef',
    parents: ['parent1234'],
    authorName: 'John Doe',
    authorEmail: 'john@example.com',
    date: new Date().toISOString(),
    message: 'feat: add new feature\n\nDetailed description here',
    filesChanged: 3,
    insertions: 25,
    deletions: 10,
    files: [
      { path: 'src/main.ts', insertions: 15, deletions: 5 },
      { path: 'README.md', insertions: 10, deletions: 0 },
      { path: 'old.ts', insertions: 0, deletions: 5 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when hash is null', () => {
    const { container } = render(
      <GitCommitDetail hash={null} detail={null} loading={false} onClose={mockOnClose} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title when hash is provided', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText('git.detail.title')).toBeInTheDocument();
  });

  it('renders loading spinner when loading', () => {
    const { container } = render(
      <GitCommitDetail hash="abc123" detail={null} loading={true} onClose={mockOnClose} />,
    );
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders commit message', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText(/feat: add new feature/)).toBeInTheDocument();
  });

  it('renders author name and email', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/<john@example\.com>/)).toBeInTheDocument();
  });

  it('renders short hash', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText('abc1234567')).toBeInTheDocument();
  });

  it('renders files changed count', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText(/3 git\.detail\.filesChanged/)).toBeInTheDocument();
  });

  it('renders file paths', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('old.ts')).toBeInTheDocument();
  });

  it('renders parent hashes', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText('parent1')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<GitCommitDetail hash="abc123" detail={detail} loading={false} onClose={mockOnClose} />);
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows not found message when detail is null', () => {
    render(<GitCommitDetail hash="abc123" detail={null} loading={false} onClose={mockOnClose} />);
    expect(screen.getByText('git.detail.notFound')).toBeInTheDocument();
  });
});

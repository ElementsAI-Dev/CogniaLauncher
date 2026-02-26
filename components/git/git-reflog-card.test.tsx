import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitReflogCard } from './git-reflog-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitReflogCard', () => {
  const mockEntries = [
    { hash: 'abc1234567890', selector: 'HEAD@{0}', action: 'commit', message: 'commit: add feature', date: new Date().toISOString() },
    { hash: 'def5678901234', selector: 'HEAD@{1}', action: 'checkout', message: 'checkout: moving from main to dev', date: new Date(Date.now() - 86400000).toISOString() },
  ];
  const mockOnGetReflog = jest.fn().mockResolvedValue(mockEntries);
  const mockOnResetTo = jest.fn().mockResolvedValue('Reset completed');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders reflog title', () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    expect(screen.getByText('git.reflog.title')).toBeInTheDocument();
  });

  it('shows load button initially', () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    expect(screen.getByText('git.reflog.load')).toBeInTheDocument();
  });

  it('shows empty state before loading', () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    expect(screen.getByText('git.reflog.empty')).toBeInTheDocument();
  });

  it('calls onGetReflog when load button is clicked', async () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    fireEvent.click(screen.getByText('git.reflog.load'));
    await waitFor(() => {
      expect(mockOnGetReflog).toHaveBeenCalledWith(50);
    });
  });

  it('renders entries after loading', async () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} onResetTo={mockOnResetTo} />);
    fireEvent.click(screen.getByText('git.reflog.load'));
    await waitFor(() => {
      expect(screen.getByText('abc1234')).toBeInTheDocument();
      expect(screen.getByText('def5678')).toBeInTheDocument();
    });
  });

  it('renders action badges after loading', async () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    fireEvent.click(screen.getByText('git.reflog.load'));
    await waitFor(() => {
      expect(screen.getByText('commit')).toBeInTheDocument();
      expect(screen.getByText('checkout')).toBeInTheDocument();
    });
  });

  it('renders entry count badge after loading', async () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    fireEvent.click(screen.getByText('git.reflog.load'));
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('hides load button after data is loaded', async () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    fireEvent.click(screen.getByText('git.reflog.load'));
    await waitFor(() => {
      expect(screen.queryByText('git.reflog.load')).not.toBeInTheDocument();
    });
  });

  it('renders reset buttons when onResetTo is provided', async () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} onResetTo={mockOnResetTo} />);
    fireEvent.click(screen.getByText('git.reflog.load'));
    await waitFor(() => {
      const resetButtons = screen.getAllByTitle('git.reflog.resetTo');
      expect(resetButtons).toHaveLength(2);
    });
  });

  it('does not render reset buttons when onResetTo is not provided', async () => {
    render(<GitReflogCard onGetReflog={mockOnGetReflog} />);
    fireEvent.click(screen.getByText('git.reflog.load'));
    await waitFor(() => {
      expect(screen.queryByTitle('git.reflog.resetTo')).not.toBeInTheDocument();
    });
  });
});

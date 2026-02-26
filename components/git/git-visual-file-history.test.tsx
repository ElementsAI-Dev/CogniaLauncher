import { render, screen } from '@testing-library/react';
import { GitVisualFileHistory } from './git-visual-file-history';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

describe('GitVisualFileHistory', () => {
  const mockOnGetFileStats = jest.fn().mockResolvedValue([]);

  it('renders visual history title', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getByText('git.visualHistory.title')).toBeInTheDocument();
  });

  it('renders file input', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getByPlaceholderText('git.history.selectFile')).toBeInTheDocument();
  });

  it('renders browse button', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getByText('git.history.browseFile')).toBeInTheDocument();
  });

  it('shows select file message when no file selected', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getAllByText('git.history.selectFile').length).toBeGreaterThanOrEqual(1);
  });
});

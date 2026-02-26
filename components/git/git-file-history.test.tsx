import { render, screen } from '@testing-library/react';
import { GitFileHistory } from './git-file-history';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

describe('GitFileHistory', () => {
  const mockOnGetHistory = jest.fn().mockResolvedValue([]);

  it('renders file history title', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    expect(screen.getByText('git.history.fileHistory')).toBeInTheDocument();
  });

  it('renders file input', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    expect(screen.getByPlaceholderText('git.history.selectFile')).toBeInTheDocument();
  });

  it('renders browse button', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    expect(screen.getByText('git.history.browseFile')).toBeInTheDocument();
  });

  it('shows select file message when no file selected', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    // The component shows selectFile text when no filePath and no history
    expect(screen.getAllByText('git.history.selectFile').length).toBeGreaterThanOrEqual(1);
  });
});

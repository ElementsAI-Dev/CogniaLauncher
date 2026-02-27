import { render, screen } from '@testing-library/react';
import { GitDiffViewer } from './git-diff-viewer';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitDiffViewer', () => {
  it('renders diff title', () => {
    render(<GitDiffViewer diff="" />);
    expect(screen.getByText('git.diffView.title')).toBeInTheDocument();
  });

  it('renders custom title when provided', () => {
    render(<GitDiffViewer diff="" title="Staged Changes" />);
    expect(screen.getByText('Staged Changes')).toBeInTheDocument();
  });

  it('shows no changes message when diff is empty', () => {
    render(<GitDiffViewer diff="" />);
    expect(screen.getByText('git.diffView.noChanges')).toBeInTheDocument();
  });

  it('renders diff content with add lines', () => {
    const diff = 'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@\n context line\n+added line\n-removed line\n context again';
    render(<GitDiffViewer diff={diff} />);
    expect(screen.getByText(/added line/)).toBeInTheDocument();
    expect(screen.getByText(/removed line/)).toBeInTheDocument();
    expect(screen.getByText(/context line/)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    const { container } = render(<GitDiffViewer diff="" loading />);
    // Should show spinner, not empty message
    expect(screen.queryByText('git.diffView.noChanges')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders line numbers', () => {
    const diff = 'line one\nline two';
    render(<GitDiffViewer diff={diff} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders hunk header lines', () => {
    const diff = '@@ -1,3 +1,4 @@\n context';
    const { container } = render(<GitDiffViewer diff={diff} />);
    // Hunk lines get blue styling
    const hunkLine = container.querySelector('.bg-blue-500\\/10');
    expect(hunkLine).toBeInTheDocument();
  });

  it('renders meta lines with muted styling', () => {
    const diff = 'diff --git a/file.ts b/file.ts\nindex abc..def';
    const { container } = render(<GitDiffViewer diff={diff} />);
    const metaLines = container.querySelectorAll('.bg-muted\\/50');
    expect(metaLines.length).toBeGreaterThanOrEqual(1);
  });

  it('renders add lines with green styling', () => {
    const diff = '+added line';
    const { container } = render(<GitDiffViewer diff={diff} />);
    const addLine = container.querySelector('.bg-green-500\\/10');
    expect(addLine).toBeInTheDocument();
  });

  it('renders delete lines with red styling', () => {
    const diff = '-removed line';
    const { container } = render(<GitDiffViewer diff={diff} />);
    const delLine = container.querySelector('.bg-red-500\\/10');
    expect(delLine).toBeInTheDocument();
  });
});

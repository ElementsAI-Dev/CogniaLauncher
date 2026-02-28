import { render, screen, fireEvent } from '@testing-library/react';
import { GitDiffViewer } from './git-diff-viewer';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const SAMPLE_DIFF = [
  'diff --git a/file.ts b/file.ts',
  '--- a/file.ts',
  '+++ b/file.ts',
  '@@ -1,3 +1,4 @@',
  ' context line',
  '-removed line',
  '+added line',
  '+another added',
  ' context again',
].join('\n');

const MULTI_FILE_DIFF = [
  'diff --git a/foo.ts b/foo.ts',
  '--- a/foo.ts',
  '+++ b/foo.ts',
  '@@ -1,2 +1,2 @@',
  '-old foo',
  '+new foo',
  'diff --git a/bar.ts b/bar.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/bar.ts',
  '@@ -0,0 +1,2 @@',
  '+line 1',
  '+line 2',
].join('\n');

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

  it('renders loading state', () => {
    const { container } = render(<GitDiffViewer diff="" loading />);
    expect(screen.queryByText('git.diffView.noChanges')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders diff content with add and del lines', () => {
    const { container } = render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    // Content is in nested spans from unified diff parsing
    expect(container.textContent).toContain('added line');
    expect(container.textContent).toContain('removed line');
    expect(container.textContent).toContain('context line');
  });

  it('renders file header with file name', () => {
    render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    expect(screen.getByText('file.ts')).toBeInTheDocument();
  });

  it('renders hunk header', () => {
    render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    expect(screen.getByText('@@ -1,3 +1,4 @@')).toBeInTheDocument();
  });

  it('shows diff stats summary', () => {
    const { container } = render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    // Stats summary: "1" + "git.diffView.file" in the header area
    expect(container.textContent).toMatch(/1\s*git\.diffView\.file/);
  });

  it('renders per-file addition/deletion counts', () => {
    render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    // +2 additions, -1 deletion for file.ts
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('renders multiple files separately', () => {
    render(<GitDiffViewer diff={MULTI_FILE_DIFF} />);
    expect(screen.getByText('foo.ts')).toBeInTheDocument();
    expect(screen.getByText('bar.ts')).toBeInTheDocument();
  });

  it('shows files changed count for multi-file diff', () => {
    const { container } = render(<GitDiffViewer diff={MULTI_FILE_DIFF} />);
    // Stats show "2 files" — the number and text may be in the same span
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('git.diffView.files');
  });

  it('collapses and expands file sections', () => {
    render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    // File should be expanded by default, showing content
    expect(screen.getByText(/context line/)).toBeInTheDocument();
    // Click file header to collapse
    fireEvent.click(screen.getByText('file.ts'));
    // Content should be hidden
    expect(screen.queryByText(/context line/)).not.toBeInTheDocument();
    // Click again to expand
    fireEvent.click(screen.getByText('file.ts'));
    expect(screen.getByText(/context line/)).toBeInTheDocument();
  });

  it('renders correct old/new line numbers in unified view', () => {
    render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    // Context line at old=1, new=1
    const allOnes = screen.getAllByText('1');
    expect(allOnes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders toolbar buttons', () => {
    render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    // Should have unified/split/word-diff/copy buttons
    expect(screen.getByTitle('git.diffView.unified')).toBeInTheDocument();
    expect(screen.getByTitle('git.diffView.split')).toBeInTheDocument();
    expect(screen.getByTitle('git.diffView.wordDiff')).toBeInTheDocument();
    expect(screen.getByTitle('git.diffView.copy')).toBeInTheDocument();
  });

  it('switches to split view when split button is clicked', () => {
    const { container } = render(<GitDiffViewer diff={SAMPLE_DIFF} />);
    fireEvent.click(screen.getByTitle('git.diffView.split'));
    // Split view uses grid-cols-2
    const grid = container.querySelector('.grid-cols-2');
    expect(grid).toBeInTheDocument();
  });

  it('handles binary file diff', () => {
    const binaryDiff = 'diff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ';
    render(<GitDiffViewer diff={binaryDiff} />);
    expect(screen.getByText('git.diffView.binary')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TerminalConfigEditorSurfaceProps } from './types';
import { TerminalConfigEditorWorkspace } from './editor-workspace';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

function StubSurface({ value }: TerminalConfigEditorSurfaceProps) {
  return <div data-testid="terminal-config-editor-surface">{value}</div>;
}

describe('TerminalConfigEditorWorkspace', () => {
  it('renders shell context, diagnostics summary, and pending-change view', async () => {
    const user = userEvent.setup();

    render(
      <TerminalConfigEditorWorkspace
        SurfaceComponent={StubSurface}
        value={'export FOO=2'}
        baselineValue={'export FOO=1'}
        language="bash"
        shellType="bash"
        configPath="/home/user/.bashrc"
        snapshotPath="/home/user/.cognia/terminal-snapshots/.bashrc.latest"
        fingerprint="abc123"
        diagnostics={[
          {
            category: 'validation',
            stage: 'validation',
            message: 'Unterminated quote',
            location: { line: 1, column: 8, endLine: 1, endColumn: 18 },
          },
        ]}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('/home/user/.bashrc')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorShellBadge')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorLanguageBadge')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorLineCount')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorDiagnosticsSummary')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /terminal\.editorViewDiagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /terminal\.editorViewChanges/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /terminal\.editorViewChanges/i }));

    expect(screen.getByText('terminal.editorPersistedBaseline')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorPendingDraft')).toBeInTheDocument();
    expect(screen.getByText('export FOO=1')).toBeInTheDocument();
    expect(screen.getByText('export FOO=2')).toBeInTheDocument();
  });

  it('returns to the editor view when diagnostics and pending changes disappear', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TerminalConfigEditorWorkspace
        SurfaceComponent={StubSurface}
        value={'export FOO=2'}
        baselineValue={'export FOO=1'}
        language="bash"
        diagnostics={[
          {
            category: 'validation',
            stage: 'validation',
            message: 'Unterminated quote',
            location: { line: 1, column: 8, endLine: 1, endColumn: 18 },
          },
        ]}
        onChange={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /terminal\.editorViewDiagnostics/i }));

    rerender(
      <TerminalConfigEditorWorkspace
        SurfaceComponent={StubSurface}
        value={'export FOO=1'}
        baselineValue={'export FOO=1'}
        language="bash"
        diagnostics={[]}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /terminal\.editorViewEditor/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /terminal\.editorViewDiagnostics/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /terminal\.editorViewChanges/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('terminal-config-editor-surface')).toBeInTheDocument();
  });

  it('supports structured editing view when structured entries are provided', async () => {
    const user = userEvent.setup();
    const onStructuredEntriesChange = jest.fn();

    render(
      <TerminalConfigEditorWorkspace
        SurfaceComponent={StubSurface}
        value={'alias ll="ls -la"'}
        baselineValue={'alias ll="ls -la"'}
        language="bash"
        diagnostics={[]}
        structuredEntries={{
          aliases: [['ll', 'ls -la']],
          exports: [],
          sources: [],
        }}
        onStructuredEntriesChange={onStructuredEntriesChange}
        onChange={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /terminal\.editorViewStructured/i }));
    expect(screen.getByTestId('terminal-config-editor-structured')).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: /^terminal\.addEnvVar$/i });
    await user.click(addButtons[0]);
    expect(onStructuredEntriesChange).toHaveBeenCalled();
  });

  it('falls back to text editor when structured view is limited', () => {
    render(
      <TerminalConfigEditorWorkspace
        SurfaceComponent={StubSurface}
        value={'if [ -f ~/.zshrc ]; then source ~/.zshrc; fi'}
        baselineValue={'if [ -f ~/.zshrc ]; then source ~/.zshrc; fi'}
        language="bash"
        diagnostics={[]}
        structuredEntries={{
          aliases: [],
          exports: [],
          sources: [],
        }}
        structuredFallbackReason="advanced syntax detected"
        onStructuredEntriesChange={jest.fn()}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /terminal\.editorViewStructured/i })).toBeDisabled();
    expect(screen.getByText('terminal.structuredEditingUnavailable')).toBeInTheDocument();
    expect(screen.getByText('advanced syntax detected')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-config-editor-surface')).toBeInTheDocument();
  });
});

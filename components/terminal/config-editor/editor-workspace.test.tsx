import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TerminalConfigEditorSurfaceProps } from './types';
import { TerminalConfigEditorWorkspace } from './editor-workspace';

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
    expect(screen.getByText('Shell bash')).toBeInTheDocument();
    expect(screen.getByText('Language bash')).toBeInTheDocument();
    expect(screen.getByText('1 line')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('1 issue detected')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /changes/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /changes/i }));

    expect(screen.getByText('Persisted Baseline')).toBeInTheDocument();
    expect(screen.getByText('Pending Draft')).toBeInTheDocument();
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

    await user.click(screen.getByRole('tab', { name: /diagnostics/i }));

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

    expect(screen.getByRole('tab', { name: /editor/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /diagnostics/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /changes/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('terminal-config-editor-surface')).toBeInTheDocument();
  });
});

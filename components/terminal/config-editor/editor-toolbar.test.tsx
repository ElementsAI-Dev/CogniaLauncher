import { render, screen } from '@testing-library/react';
import { TerminalConfigEditorToolbar } from './editor-toolbar';

describe('TerminalConfigEditorToolbar', () => {
  it('renders key status badges and metadata chips', () => {
    render(
      <TerminalConfigEditorToolbar
        configPath="/home/user/.bashrc"
        fingerprint="1234567890abcdef"
        hasDiagnostics
        hasPendingChanges
        language="bash"
        lineCount={2}
        shellType="bash"
        snapshotPath="/home/user/.snapshots/.bashrc.latest"
      />,
    );

    expect(screen.getByText('Shell bash')).toBeInTheDocument();
    expect(screen.getByText('Language bash')).toBeInTheDocument();
    expect(screen.getByText('2 lines')).toBeInTheDocument();
    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByText('/home/user/.bashrc')).toBeInTheDocument();
    expect(screen.getByText('snapshot ready')).toBeInTheDocument();
    expect(screen.getByText('1234567890ab…')).toBeInTheDocument();
  });

  it('uses singular label for one line', () => {
    render(
      <TerminalConfigEditorToolbar
        hasDiagnostics={false}
        hasPendingChanges={false}
        language="powershell"
        lineCount={1}
      />,
    );

    expect(screen.getByText('1 line')).toBeInTheDocument();
  });
});

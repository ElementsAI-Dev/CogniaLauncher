import { render, screen } from '@testing-library/react';
import { TerminalConfigEditorToolbar } from './editor-toolbar';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

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

    expect(screen.getByText('terminal.editorShellBadge')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorLanguageBadge')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorLineCount')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorViewDiagnostics')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorUnsavedChanges')).toBeInTheDocument();
    expect(screen.getByText('/home/user/.bashrc')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorSnapshotReady')).toBeInTheDocument();
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

    expect(screen.getByText('terminal.editorLineCount')).toBeInTheDocument();
  });
});

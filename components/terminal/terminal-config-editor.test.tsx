import { render, screen } from '@testing-library/react';
import { TerminalConfigEditor } from './terminal-config-editor';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('./config-editor/enhanced-surface', () => ({
  TerminalConfigEditorEnhanced: () => (
    <div data-testid="terminal-config-editor-enhanced">enhanced-editor</div>
  ),
}));

describe('TerminalConfigEditor', () => {
  it('keeps the stable adapter entry wired to the editor workspace', async () => {
    render(
      <TerminalConfigEditor
        value={'export FOO=1'}
        baselineValue={'export FOO=1'}
        language="bash"
        diagnostics={[]}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('terminal-config-editor-workspace')).toBeInTheDocument();
    expect(await screen.findByTestId('terminal-config-editor-highlighted')).toBeInTheDocument();
  });

  it('loads the enhanced surface when capability requests enhanced mode', async () => {
    render(
      <TerminalConfigEditor
        value={'export FOO=1'}
        baselineValue={'export FOO=1'}
        language="bash"
        diagnostics={[]}
        capability={{
          mode: 'enhanced',
          enhancementLevel: 'enhanced',
          bundleId: 'shell-posix-vscode-compat',
          bundleLabel: 'POSIX Shell Essentials',
          languageId: 'terminal-bash',
          supportsCompletion: true,
          supportsInlineDiagnostics: true,
          fallbackReason: null,
          contributions: [],
        }}
        onChange={jest.fn()}
      />,
    );

    expect(await screen.findByTestId('terminal-config-editor-enhanced')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { TerminalConfigEditor } from './terminal-config-editor';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
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
});

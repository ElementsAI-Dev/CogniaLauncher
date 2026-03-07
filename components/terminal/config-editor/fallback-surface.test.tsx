import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalConfigEditorFallback } from './fallback-surface';

describe('TerminalConfigEditorFallback', () => {
  it('renders a textarea fallback and propagates changes', () => {
    const onChange = jest.fn();

    render(
      <TerminalConfigEditorFallback
        value="export FOO=1"
        language="bash"
        diagnostics={[]}
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId('terminal-config-editor-fallback');
    fireEvent.change(textarea, { target: { value: 'export FOO=2' } });

    expect(onChange).toHaveBeenCalledWith('export FOO=2');
  });
});

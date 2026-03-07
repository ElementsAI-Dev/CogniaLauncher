import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalConfigEditorHighlighted } from './terminal-config-editor-highlighted';

describe('TerminalConfigEditorHighlighted', () => {
  it('renders highlighted editor surface with gutter and preview', () => {
    const { container } = render(
      <TerminalConfigEditorHighlighted
        value={'export FOO=1\nexport BAR=2'}
        language="bash"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('terminal-config-editor-highlighted')).toBeInTheDocument();
    expect(container.querySelectorAll('.border-r > div')).toHaveLength(2);
    expect(screen.getByText('Highlight Preview')).toBeInTheDocument();
  });

  it('marks diagnostic lines in the gutter', () => {
    const { container } = render(
      <TerminalConfigEditorHighlighted
        value={'export FOO="oops'}
        language="bash"
        diagnostics={[
          {
            category: 'validation',
            stage: 'validation',
            message: 'Unterminated double quote',
            location: { line: 1, column: 8, endLine: 1, endColumn: 18 },
          },
        ]}
        onChange={jest.fn()}
      />,
    );

    expect(container.querySelector('.text-destructive')).toHaveTextContent('1');
  });

  it('supports tab insertion in textarea', () => {
    const onChange = jest.fn();
    render(
      <TerminalConfigEditorHighlighted
        value={'export FOO=1'}
        language="bash"
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId('terminal-config-editor-highlighted');
    fireEvent.keyDown(textarea, { key: 'Tab' });

    expect(onChange).toHaveBeenCalledWith('  export FOO=1');
  });

  it('wraps selected text with matching pairs', () => {
    const onChange = jest.fn();
    render(
      <TerminalConfigEditorHighlighted
        value="FOO"
        language="bash"
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId('terminal-config-editor-highlighted') as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 3);
    fireEvent.keyDown(textarea, { key: '"' });

    expect(onChange).toHaveBeenCalledWith('"FOO"');
  });
});

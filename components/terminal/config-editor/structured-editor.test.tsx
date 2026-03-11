import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalConfigStructuredEditor } from './structured-editor';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('TerminalConfigStructuredEditor', () => {
  it('shows fallback alert when structured editing is unavailable', () => {
    render(
      <TerminalConfigStructuredEditor
        entries={{ aliases: [], exports: [], sources: [] }}
        fallbackReason="unsupported syntax"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.structuredEditingUnavailable')).toBeInTheDocument();
    expect(screen.getByText('unsupported syntax')).toBeInTheDocument();
  });

  it('adds alias entry when clicking add button in aliases section', () => {
    const onChange = jest.fn();
    render(
      <TerminalConfigStructuredEditor
        entries={{ aliases: [], exports: [], sources: [] }}
        onChange={onChange}
      />,
    );

    const addButtons = screen.getAllByRole('button', { name: /^terminal\.addEnvVar$/i });
    fireEvent.click(addButtons[0]);

    expect(onChange).toHaveBeenCalledWith({
      aliases: [['', '']],
      exports: [],
      sources: [],
    });
  });

  it('removes alias entry', () => {
    const onChange = jest.fn();
    render(
      <TerminalConfigStructuredEditor
        entries={{ aliases: [['ll', 'ls -la']], exports: [], sources: [] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /terminal\.structuredRemoveAlias/i }));

    expect(onChange).toHaveBeenCalledWith({
      aliases: [],
      exports: [],
      sources: [],
    });
  });
});

import { render, screen } from '@testing-library/react';
import {
  getDiagnosticSummaryLabel,
  TerminalConfigEditorDiagnosticsPanel,
} from './diagnostics-panel';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('TerminalConfigEditorDiagnosticsPanel', () => {
  it('returns null when diagnostics list is empty', () => {
    const { container } = render(
      <TerminalConfigEditorDiagnosticsPanel diagnostics={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders diagnostics summary, location, and message', () => {
    render(
      <TerminalConfigEditorDiagnosticsPanel
        diagnostics={[
          {
            category: 'validation',
            stage: 'parse',
            message: 'Unterminated quote',
            location: { line: 3, column: 8, endLine: 3, endColumn: 20 },
          },
        ]}
      />,
    );

    expect(screen.getByText('terminal.editorDiagnosticsSummary')).toBeInTheDocument();
    expect(screen.getByText('validation')).toBeInTheDocument();
    expect(screen.getByText('parse')).toBeInTheDocument();
    expect(screen.getByText('L3:8')).toBeInTheDocument();
    expect(screen.getByText('Unterminated quote')).toBeInTheDocument();
  });

  it('formats summary label correctly for plural counts', () => {
    expect(getDiagnosticSummaryLabel(2)).toBe('2 issues detected');
  });
});

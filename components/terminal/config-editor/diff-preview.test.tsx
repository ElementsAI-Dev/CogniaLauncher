import { render, screen } from '@testing-library/react';
import { TerminalConfigEditorDiffPreview } from './diff-preview';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('TerminalConfigEditorDiffPreview', () => {
  it('renders baseline and pending draft content', () => {
    render(
      <TerminalConfigEditorDiffPreview
        baselineValue={'export FOO=1'}
        value={'export FOO=2'}
      />,
    );

    expect(screen.getByText('terminal.editorPersistedBaseline')).toBeInTheDocument();
    expect(screen.getByText('terminal.editorPendingDraft')).toBeInTheDocument();
    expect(screen.getByText('export FOO=1')).toBeInTheDocument();
    expect(screen.getByText('export FOO=2')).toBeInTheDocument();
  });
});

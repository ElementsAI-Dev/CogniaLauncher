import { render, screen } from '@testing-library/react';
import { TerminalConfigEditorDiffPreview } from './diff-preview';

describe('TerminalConfigEditorDiffPreview', () => {
  it('renders baseline and pending draft content', () => {
    render(
      <TerminalConfigEditorDiffPreview
        baselineValue={'export FOO=1'}
        value={'export FOO=2'}
      />,
    );

    expect(screen.getByText('Persisted Baseline')).toBeInTheDocument();
    expect(screen.getByText('Pending Draft')).toBeInTheDocument();
    expect(screen.getByText('export FOO=1')).toBeInTheDocument();
    expect(screen.getByText('export FOO=2')).toBeInTheDocument();
  });
});

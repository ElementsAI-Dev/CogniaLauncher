import { render, screen } from '@testing-library/react';
import { ToolDetailPageClient } from './tool-detail-page-client';

const mockAddRecent = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/use-toolbox', () => ({
  useToolbox: () => ({
    allTools: [
      {
        id: 'builtin:json-formatter',
        name: 'JSON Formatter',
        description: 'Format JSON',
        icon: 'Braces',
        category: 'formatters',
        keywords: ['json'],
        isBuiltIn: true,
        isNew: false,
        isBeta: false,
        builtInDef: { id: 'json-formatter' },
      },
    ],
  }),
}));

jest.mock('@/lib/stores/toolbox', () => ({
  useToolboxStore: (selector: (state: { addRecent: (toolId: string) => void }) => unknown) =>
    selector({ addRecent: mockAddRecent }),
}));

jest.mock('@/components/toolbox/built-in-tool-renderer', () => ({
  BuiltInToolRenderer: ({ builtInId }: { builtInId: string }) => <div>builtin:{builtInId}</div>,
}));

jest.mock('@/components/toolbox/plugin-tool-runner', () => ({
  PluginToolRunner: () => <div>plugin-tool</div>,
}));

describe('ToolDetailPageClient', () => {
  beforeEach(() => {
    mockAddRecent.mockReset();
  });

  it('renders built-in tool by raw tool id on full page', () => {
    render(<ToolDetailPageClient toolId="json-formatter" />);
    expect(screen.getByText('builtin:json-formatter')).toBeInTheDocument();
  });

  it('shows fallback when tool is unknown', () => {
    render(<ToolDetailPageClient toolId="unknown-tool" />);
    expect(screen.getByText('toolbox.search.noResults')).toBeInTheDocument();
  });
});


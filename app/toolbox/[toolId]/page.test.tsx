import { render, screen } from '@testing-library/react';
import ToolboxToolDetailPage, { generateStaticParams } from './page';
import { TOOL_REGISTRY } from '@/lib/constants/toolbox';

jest.mock('@/components/toolbox/tool-detail-page-client', () => ({
  ToolDetailPageClient: ({ toolId }: { toolId: string }) => (
    <div data-testid="tool-detail-page-client">{toolId}</div>
  ),
}));

describe('ToolboxToolDetailPage', () => {
  it('generateStaticParams returns only filesystem-safe canonical toolbox ids', () => {
    const params = generateStaticParams();
    const paramIds = params.map((item) => item.toolId);
    TOOL_REGISTRY.forEach((tool) => {
      expect(paramIds).toContain(tool.id);
      expect(paramIds).not.toContain(`builtin:${tool.id}`);
      expect(paramIds).not.toContain(`plugin:${tool.id}`);
    });
  });

  it('decodes encoded tool id for canonical route params', async () => {
    const element = await ToolboxToolDetailPage({
      params: Promise.resolve({ toolId: 'builtin%3Ajson-formatter' }),
    });
    render(element);
    expect(screen.getByTestId('tool-detail-page-client')).toHaveTextContent('builtin:json-formatter');
  });
});

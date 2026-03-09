import { render, screen } from '@testing-library/react';
import ToolboxToolDetailPage, { generateStaticParams } from './page';
import { TOOL_REGISTRY } from '@/lib/constants/toolbox';

jest.mock('@/components/toolbox/tool-detail-page-client', () => ({
  ToolDetailPageClient: ({ toolId }: { toolId: string }) => (
    <div data-testid="tool-detail-page-client">{toolId}</div>
  ),
}));

describe('ToolboxToolDetailPage', () => {
  it('generateStaticParams returns raw and encoded toolbox ids', () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(TOOL_REGISTRY.length * 3);
    TOOL_REGISTRY.forEach((tool) => {
      expect(params).toContainEqual({ toolId: tool.id });
      expect(params).toContainEqual({ toolId: `builtin:${tool.id}` });
      expect(params).toContainEqual({ toolId: `builtin%3A${tool.id}` });
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

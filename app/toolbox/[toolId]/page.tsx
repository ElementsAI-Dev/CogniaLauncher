import { TOOL_REGISTRY } from '@/lib/constants/toolbox';
import { ToolDetailPageClient } from '@/components/toolbox/tool-detail-page-client';
import { decodeToolIdFromPath } from '@/lib/toolbox-route';

export function generateStaticParams() {
  return TOOL_REGISTRY.map((tool) => ({ toolId: tool.id }));
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ toolId: string }>;
}) {
  const { toolId } = await params;
  return <ToolDetailPageClient toolId={decodeToolIdFromPath(toolId)} />;
}

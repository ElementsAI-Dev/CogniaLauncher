import { TOOL_REGISTRY } from '@/lib/constants/toolbox';
import { ToolDetailPageClient } from '@/components/toolbox/tool-detail-page-client';

export function generateStaticParams() {
  return TOOL_REGISTRY.map((tool) => ({ toolId: tool.id }));
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ toolId: string }>;
}) {
  const { toolId } = await params;
  return <ToolDetailPageClient toolId={toolId} />;
}

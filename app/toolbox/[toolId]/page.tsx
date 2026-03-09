import { TOOL_REGISTRY } from '@/lib/constants/toolbox';
import { ToolDetailPageClient } from '@/components/toolbox/tool-detail-page-client';
import { decodeToolIdFromPath, encodeToolIdForPath } from '@/lib/toolbox-route';

export function generateStaticParams() {
  const ids = TOOL_REGISTRY.flatMap((tool) => {
    const builtInRawId = `builtin:${tool.id}`;
    return [
      tool.id,
      encodeToolIdForPath(tool.id),
      builtInRawId,
      encodeToolIdForPath(builtInRawId),
    ];
  });

  return [...new Set(ids)].map((toolId) => ({ toolId }));
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ toolId: string }>;
}) {
  const { toolId } = await params;
  return <ToolDetailPageClient toolId={decodeToolIdFromPath(toolId)} />;
}

'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ToolDetailPageClient } from '@/components/toolbox/tool-detail-page-client';
import { decodeToolIdFromPath, getToolboxDetailPath } from '@/lib/toolbox-route';

export default function LegacyToolDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolId = useMemo(() => {
    const rawToolId = searchParams.get('id') ?? '';
    return decodeToolIdFromPath(rawToolId);
  }, [searchParams]);

  useEffect(() => {
    if (!toolId) {
      return;
    }

    router.replace(getToolboxDetailPath(toolId));
  }, [router, toolId]);

  return <ToolDetailPageClient toolId="" />;
}

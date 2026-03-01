'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ToolDetailPageClient } from '@/components/toolbox/tool-detail-page-client';
import { PageLoadingSkeleton } from '@/components/layout/page-loading-skeleton';

function ToolPageContent() {
  const searchParams = useSearchParams();
  const toolId = searchParams.get('id') ?? '';
  return <ToolDetailPageClient toolId={toolId} />;
}

export default function ToolPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="cards" />}>
      <ToolPageContent />
    </Suspense>
  );
}

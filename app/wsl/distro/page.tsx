'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WslDistroDetailPage } from '@/components/wsl/wsl-distro-detail-page';
import { PageLoadingSkeleton } from '@/components/layout/page-loading-skeleton';

function WslDistroPageContent() {
  const searchParams = useSearchParams();
  const distroName = searchParams.get('name') ?? '';

  if (!distroName) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">No distribution specified.</p>
      </div>
    );
  }

  return <WslDistroDetailPage distroName={distroName} />;
}

export default function WslDistroPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="detail" />}>
      <WslDistroPageContent />
    </Suspense>
  );
}

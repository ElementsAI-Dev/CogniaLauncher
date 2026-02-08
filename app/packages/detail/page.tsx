'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PackageDetailPage } from '@/components/packages/detail/package-detail-page';
import { PageLoadingSkeleton } from '@/components/layout/page-loading-skeleton';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';

function PackageDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();

  const packageName = searchParams.get('name') ?? '';
  const providerId = searchParams.get('provider') ?? undefined;

  if (!packageName) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-4 bg-muted rounded-full mb-6">
          <Package className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">{t('packages.detail.packageNotSpecified')}</h2>
        <p className="text-muted-foreground mb-6">{t('packages.detail.packageNotSpecifiedDesc')}</p>
        <Button onClick={() => router.push('/packages')}>
          {t('packages.detail.goToPackages')}
        </Button>
      </div>
    );
  }

  return <PackageDetailPage packageName={packageName} providerId={providerId} />;
}

export default function PackageDetailRoute() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="detail" />}>
      <PackageDetailContent />
    </Suspense>
  );
}

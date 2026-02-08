import { CacheDetailPageClient } from '@/components/cache/detail/cache-detail-page';

const CACHE_TYPES = ['download', 'metadata', 'external'] as const;

export function generateStaticParams() {
  return CACHE_TYPES.map((cacheType) => ({ cacheType }));
}

export default async function CacheDetailPage({
  params,
}: {
  params: Promise<{ cacheType: string }>;
}) {
  const { cacheType } = await params;
  return <CacheDetailPageClient cacheType={cacheType} />;
}

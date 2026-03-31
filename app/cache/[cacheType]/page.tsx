import { Suspense } from "react";
import { CacheDetailPageClient } from "@/components/cache/detail/cache-detail-page";

const CACHE_TYPES = ["download", "metadata", "default_downloads", "external"] as const;
type CacheType = (typeof CACHE_TYPES)[number];

export function generateStaticParams() {
  return CACHE_TYPES.map((cacheType) => ({ cacheType }));
}

export default async function CacheDetailPage({
  params,
}: {
  params: Promise<{ cacheType: CacheType }>;
}) {
  const { cacheType } = await params;
  return (
    <Suspense fallback={<CacheDetailPageClient cacheType={cacheType} />}>
      <CacheDetailPageClient cacheType={cacheType} />
    </Suspense>
  );
}

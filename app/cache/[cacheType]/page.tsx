import { CacheDetailPageClient } from "@/components/cache/detail/cache-detail-page";
import { parseExternalCacheDetailTarget } from "@/lib/cache/scopes";

const CACHE_TYPES = ["download", "metadata", "default_downloads", "external"] as const;
type CacheType = (typeof CACHE_TYPES)[number];

export function generateStaticParams() {
  return CACHE_TYPES.map((cacheType) => ({ cacheType }));
}

export default async function CacheDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cacheType: CacheType }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { cacheType } = await params;
  const target = parseExternalCacheDetailTarget(await searchParams);
  return (
    <CacheDetailPageClient
      cacheType={cacheType}
      targetId={target.targetId}
      targetType={target.targetType}
    />
  );
}

import { ALL_PROVIDER_IDS } from '@/lib/constants/providers';
import { ProviderDetailPageClient } from '@/components/provider-management/detail';

// Required for static export: pre-generate all known provider pages
export function generateStaticParams() {
  return ALL_PROVIDER_IDS.map((id) => ({ id }));
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProviderDetailPageClient providerId={id} />;
}

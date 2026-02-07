import { LANGUAGES } from '@/lib/constants/environments';
import { EnvDetailPageClient } from '@/components/environments/detail/env-detail-page';

// Required for static export: pre-generate all known environment type pages
export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({
    envType: lang.id,
  }));
}

export default async function EnvironmentDetailPage({
  params,
}: {
  params: Promise<{ envType: string }>;
}) {
  const { envType } = await params;
  return <EnvDetailPageClient envType={envType} />;
}

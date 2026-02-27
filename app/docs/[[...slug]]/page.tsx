import { notFound } from 'next/navigation';
import { getDocContentBilingual, getAllDocSlugs, getDocBasePath } from '@/lib/docs/content';
import { DocsPageClient } from './docs-page-client';

export function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const { zh, en } = getDocContentBilingual(slug);
  if (!zh && !en) notFound();
  const basePath = getDocBasePath(slug);
  return <DocsPageClient contentZh={zh} contentEn={en} slug={slug} basePath={basePath} />;
}

import { notFound } from 'next/navigation';
import { getDocPageDataBilingual, getAllDocSlugs, getDocBasePath, buildSearchIndex } from '@/lib/docs/content';
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
  const { zh, en } = getDocPageDataBilingual(slug);
  if (!zh && !en) notFound();
  const basePath = getDocBasePath(slug);
  const searchIndex = buildSearchIndex();
  return <DocsPageClient docZh={zh} docEn={en} slug={slug} basePath={basePath} searchIndex={searchIndex} />;
}

import { notFound } from 'next/navigation';
import { getDocContent, getAllDocSlugs, getDocBasePath } from '@/lib/docs/content';
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
  const content = getDocContent(slug);
  if (!content) notFound();
  const basePath = getDocBasePath(slug);
  return <DocsPageClient content={content} slug={slug} basePath={basePath} />;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { extractDocExcerpt, getAllDocSlugs, getDocsRouteData } from '@/lib/docs/content';
import { arrayToSlug, getDocTitle } from '@/lib/docs/navigation';
import { DocsPageClient } from './docs-page-client';

export function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({ slug }));
}

function getDocsMetadataTitle(slug?: string[]): string {
  const currentSlug = arrayToSlug(slug);
  if (currentSlug === 'index') {
    return 'CogniaLauncher Docs';
  }

  const title = getDocTitle(currentSlug, 'en') ?? getDocTitle(currentSlug, 'zh');
  return title ? `${title} | CogniaLauncher Docs` : 'CogniaLauncher Docs';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { renderedDoc } = getDocsRouteData(slug);

  return {
    title: getDocsMetadataTitle(slug),
    description: renderedDoc
      ? extractDocExcerpt(renderedDoc.content)
      : 'Documentation for CogniaLauncher',
  };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const routeData = getDocsRouteData(slug);

  if (!routeData.docZh && !routeData.docEn) notFound();

  return (
    <DocsPageClient
      docZh={routeData.docZh}
      docEn={routeData.docEn}
      slug={slug}
      basePath={routeData.basePath}
      searchIndex={routeData.searchIndex}
    />
  );
}

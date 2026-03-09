'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { getBreadcrumbs } from '@/lib/docs/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

interface DocsBreadcrumbProps {
  slug: string;
  className?: string;
}

export function DocsBreadcrumb({ slug, className }: DocsBreadcrumbProps) {
  const { locale } = useLocale();
  const crumbs = getBreadcrumbs(slug);

  if (crumbs.length <= 1) return null;

  return (
    <Breadcrumb className={cn('mb-4', className)}>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          const title = locale === 'en' ? (crumb.titleEn ?? crumb.title) : crumb.title;
          const href = crumb.slug === 'index' ? '/docs' : `/docs/${crumb.slug}`;
          const key = crumb.slug ?? `${crumb.title}-${i}`;

          return [
            <BreadcrumbItem key={`${key}-item`} className={cn(isLast ? 'max-w-[220px]' : 'max-w-[170px]')}>
              {isLast ? (
                <BreadcrumbPage className="truncate font-medium">{title}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild className="truncate">
                  <Link href={href}>{title}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>,
            !isLast ? <BreadcrumbSeparator key={`${key}-separator`} /> : null,
          ];
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

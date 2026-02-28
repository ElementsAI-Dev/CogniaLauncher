'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { getBreadcrumbs } from '@/lib/docs/navigation';
import { ChevronRight } from 'lucide-react';
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
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm text-muted-foreground mb-4', className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        const title = locale === 'en' ? (crumb.titleEn ?? crumb.title) : crumb.title;
        const href = crumb.slug === 'index' ? '/docs' : `/docs/${crumb.slug}`;

        return (
          <span key={crumb.slug ?? crumb.title} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
            {isLast ? (
              <span className="text-foreground font-medium truncate max-w-[200px]">{title}</span>
            ) : (
              <Link
                href={href}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {title}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

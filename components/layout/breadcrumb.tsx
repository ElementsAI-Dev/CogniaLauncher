'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';

const NAV_LABELS: Record<string, string> = {
  '': 'nav.dashboard',
  environments: 'nav.environments',
  packages: 'nav.packages',
  providers: 'nav.providers',
  cache: 'nav.cache',
  downloads: 'nav.downloads',
  logs: 'nav.logs',
  settings: 'nav.settings',
  about: 'nav.about',
};

export function Breadcrumb() {
  const pathname = usePathname();
  const { t } = useLocale();
  const segments = pathname.split('/').filter(Boolean);
  const items = [{ href: '/', label: t('nav.dashboard') }];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const labelKey = NAV_LABELS[segment];
    const fallbackLabel = segment.charAt(0).toUpperCase() + segment.slice(1);
    items.push({ href, label: labelKey ? t(labelKey) : fallbackLabel });
  });

  return (
    <nav aria-label={t('breadcrumbs.label')}>
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
              {isLast ? (
                <span className="font-medium text-foreground">{item.label}</span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

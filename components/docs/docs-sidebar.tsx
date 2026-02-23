'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';
import { ChevronRight } from 'lucide-react';
import { DOC_NAV, slugToArray, type DocNavItem } from '@/lib/docs/navigation';

interface DocsSidebarProps {
  className?: string;
}

function NavItem({ item, locale }: { item: DocNavItem; locale: string }) {
  const pathname = usePathname();

  if (!item.slug) return null;

  const slugArr = slugToArray(item.slug);
  const href = slugArr.length === 0 ? '/docs' : `/docs/${slugArr.join('/')}`;
  const isActive = pathname === href;
  const title = locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  return (
    <Link
      href={href}
      className={cn(
        'block rounded-md px-3 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      )}
    >
      {title}
    </Link>
  );
}

function NavSection({
  item,
  locale,
  defaultOpen,
}: {
  item: DocNavItem;
  locale: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  // Keep section open when it becomes active via navigation
  if (defaultOpen && !open) {
    setOpen(true);
  }

  if (!item.children || item.children.length === 0) {
    return <NavItem item={item} locale={locale} />;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
        <span>{title}</span>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 space-y-0.5 border-l border-border pl-3 mt-0.5">
          {item.children.map((child) => (
            <NavItem key={child.slug ?? child.title} item={child} locale={locale} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DocsSidebar({ className }: DocsSidebarProps) {
  const pathname = usePathname();
  const { locale } = useLocale();

  // Determine which sections should be open by default
  const isSectionActive = (item: DocNavItem): boolean => {
    if (item.children) {
      return item.children.some((child) => {
        if (!child.slug) return false;
        const slugArr = slugToArray(child.slug);
        const href = slugArr.length === 0 ? '/docs' : `/docs/${slugArr.join('/')}`;
        return pathname === href;
      });
    }
    return false;
  };

  return (
    <aside className={cn('w-60 shrink-0', className)}>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <nav className="space-y-1 pr-2 py-2" aria-label="Documentation">
          {DOC_NAV.map((item) => {
            if (item.children) {
              return (
                <NavSection
                  key={item.title}
                  item={item}
                  locale={locale}
                  defaultOpen={isSectionActive(item)}
                />
              );
            }
            return <NavItem key={item.slug ?? item.title} item={item} locale={locale} />;
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

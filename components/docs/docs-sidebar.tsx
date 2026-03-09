'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/providers/locale-provider';
import { ChevronRight, Menu } from 'lucide-react';
import { DOC_NAV, slugToArray, type DocNavItem } from '@/lib/docs/navigation';
import { DocsSearch } from './docs-search';

import type { DocSearchEntry } from '@/lib/docs/content';

interface DocsSidebarProps {
  className?: string;
  searchIndex?: DocSearchEntry[];
}

function NavItem({ item, locale }: { item: DocNavItem; locale: string }) {
  const pathname = usePathname();
  const linkRef = useRef<HTMLAnchorElement>(null);

  const slugArr = item.slug ? slugToArray(item.slug) : [];
  const href = item.slug ? (slugArr.length === 0 ? '/docs' : `/docs/${slugArr.join('/')}`) : '';
  const isActive = !!item.slug && pathname === href;
  const title = locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  // Auto-scroll active item into view (#5)
  useEffect(() => {
    if (isActive && linkRef.current) {
      linkRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isActive]);

  if (!item.slug) return null;

  return (
    <Link
      ref={linkRef}
      href={href}
      aria-current={isActive ? 'page' : undefined}
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
  const [userOpen, setUserOpen] = useState(defaultOpen);
  const open = defaultOpen || userOpen;
  const title = locale === 'en' ? (item.titleEn ?? item.title) : item.title;

  if (!item.children || item.children.length === 0) {
    return <NavItem item={item} locale={locale} />;
  }

  return (
    <Collapsible open={open} onOpenChange={setUserOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-full justify-between rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted/50">
          <span className="truncate">{title}</span>
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-90'
            )}
          />
        </Button>
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

function SidebarNav({ locale, isSectionActive }: { locale: string; isSectionActive: (item: DocNavItem) => boolean }) {
  return (
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
  );
}

function useSidebarState() {
  const pathname = usePathname();
  const { t, locale } = useLocale();

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

  return { t, locale, isSectionActive };
}

export function DocsSidebar({ className, searchIndex }: DocsSidebarProps) {
  const { locale, isSectionActive } = useSidebarState();

  return (
    <aside className={cn('w-60 shrink-0 sticky top-0 self-start h-screen flex flex-col', className)}>
      <div className="pr-2 pt-2 pb-1 shrink-0">
        <DocsSearch searchIndex={searchIndex} />
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <SidebarNav locale={locale} isSectionActive={isSectionActive} />
      </ScrollArea>
    </aside>
  );
}

export function DocsMobileSidebar({ searchIndex }: { searchIndex?: DocSearchEntry[] }) {
  const { t, locale, isSectionActive } = useSidebarState();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 lg:hidden" aria-label={t('docs.mobileMenu')}>
          <Menu className="h-4 w-4" />
          {t('docs.mobileMenu')}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t('docs.title')}</SheetTitle>
        </SheetHeader>
        <div className="px-2 pt-2">
          <DocsSearch searchIndex={searchIndex} />
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="p-2" onClick={() => setOpen(false)}>
            <SidebarNav locale={locale} isSectionActive={isSectionActive} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LogPanel } from './log-panel';
import { useLogStore } from '@/lib/stores/log';
import { useLocale } from '@/components/providers/locale-provider';
import { ScrollText } from 'lucide-react';

interface LogDrawerProps {
  side?: 'right' | 'bottom';
}

export function LogDrawer({ side = 'right' }: LogDrawerProps) {
  const { t } = useLocale();
  const { drawerOpen, closeDrawer, getLogStats } = useLogStore();
  const stats = getLogStats();

  return (
    <Sheet open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side={side}
        className={side === 'bottom' ? 'h-[60vh]' : 'w-[500px] sm:w-[600px] sm:max-w-none'}
      >
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            <span>{t('logs.title')}</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({stats.total} {t('logs.entries')})
            </span>
          </SheetTitle>
        </SheetHeader>
        
        <div className="h-[calc(100%-60px)] pt-4">
          <LogPanel 
            className="h-full rounded-lg border" 
            maxHeight="100%"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

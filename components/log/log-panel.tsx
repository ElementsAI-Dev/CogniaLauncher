'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogEntry } from './log-entry';
import { LogToolbar } from './log-toolbar';
import { useLogStore } from '@/lib/stores/log';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { FileText, AlertCircle } from 'lucide-react';

function EmptyState() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
      <FileText className="h-12 w-12 mb-4 opacity-50" />
      <p className="text-sm font-medium">{t('logs.noLogs')}</p>
      <p className="text-xs mt-1">{t('logs.noLogsDescription')}</p>
    </div>
  );
}

function NotTauriState() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
      <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
      <p className="text-sm font-medium">{t('logs.notAvailable')}</p>
      <p className="text-xs mt-1">{t('logs.notAvailableDescription')}</p>
    </div>
  );
}

interface LogPanelProps {
  className?: string;
  showToolbar?: boolean;
  maxHeight?: string;
}

/**
 * Log panel component for displaying log entries.
 * 
 * Note: Console interception and Tauri event listeners are handled by LogProvider
 * at the app level. This component only handles UI rendering and auto-scroll.
 */
export function LogPanel({
  className,
  showToolbar = true,
  maxHeight = '100%',
}: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { autoScroll, getFilteredLogs, filter } = useLogStore();

  const filteredLogs = getFilteredLogs();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [filteredLogs.length, autoScroll]);

  if (!isTauri()) {
    return (
      <div className={className}>
        <NotTauriState />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`} style={{ maxHeight }}>
      {showToolbar && <LogToolbar />}
      
      <ScrollArea ref={scrollRef} className="flex-1">
        {filteredLogs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border/50">
            {filteredLogs.map((entry) => (
              <LogEntry
                key={entry.id}
                entry={entry}
                highlightText={filter.search}
                highlightRegex={Boolean(filter.useRegex)}
                allowCollapse
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

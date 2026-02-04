'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Monitor, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SystemInfo } from '../_hooks/use-about-data';
import type { SelfUpdateInfo } from '@/lib/tauri';
import { APP_VERSION } from '@/lib/app-version';

interface InfoRowProps {
  label: string;
  value: string | undefined;
  isMono?: boolean;
  isLoading: boolean;
}

function InfoRow({ label, value, isMono = false, isLoading }: InfoRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : isMono && value && value.length > 25 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[13px] font-medium text-foreground font-mono truncate max-w-[200px] cursor-help">
              {value}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs break-all">
            {value}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className={`text-[13px] font-medium text-foreground ${isMono ? 'font-mono' : ''}`}>
          {value || 'Unknown'}
        </span>
      )}
    </div>
  );
}

interface SystemInfoCardProps {
  systemInfo: SystemInfo | null;
  systemLoading: boolean;
  updateInfo: SelfUpdateInfo | null;
  systemError: string | null;
  onRetry: () => void;
  t: (key: string) => string;
}

export function SystemInfoCard({
  systemInfo,
  systemLoading,
  updateInfo,
  systemError,
  onRetry,
  t,
}: SystemInfoCardProps) {
  const [copied, setCopied] = useState(false);

  const copySystemInfo = async () => {
    const info = `
CogniaLauncher System Information
================================
Version: v${updateInfo?.current_version || APP_VERSION}
OS: ${systemInfo?.os || 'Unknown'}
Architecture: ${systemInfo?.arch || 'Unknown'}
Home Directory: ${systemInfo?.homeDir || '~/.cognia'}
Locale: ${systemInfo?.locale || 'en-US'}
    `.trim();

    try {
      await navigator.clipboard.writeText(info);
      setCopied(true);
      toast.success(t('about.copiedToClipboard'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('about.copyFailed'));
    }
  };

  return (
    <Card className="rounded-xl border bg-card" role="region" aria-labelledby="system-info-heading">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-foreground" aria-hidden="true" />
            <span id="system-info-heading" className="text-base font-semibold text-foreground">
              {t('about.systemInfo')}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={copySystemInfo}
                className="h-8 px-2"
                aria-label={t('about.copySystemInfo')}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('about.copySystemInfo')}</TooltipContent>
          </Tooltip>
        </div>

        {systemError && (
          <Alert variant="destructive" role="alert" className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <AlertDescription>{t('about.systemInfoFailed')}</AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2 text-destructive-foreground hover:bg-destructive/80"
            >
              <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
              {t('about.systemInfoRetry')}
            </Button>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <InfoRow label={t('about.operatingSystem')} value={systemInfo?.os} isLoading={systemLoading} />
            <InfoRow label={t('about.architecture')} value={systemInfo?.arch} isLoading={systemLoading} />
          </div>
          <div className="space-y-3">
            <InfoRow label={t('about.homeDirectory')} value={systemInfo?.homeDir} isMono isLoading={systemLoading} />
            <InfoRow label={t('about.locale')} value={systemInfo?.locale} isLoading={systemLoading} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

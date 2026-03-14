'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import type { CacheVerificationResult } from '@/lib/tauri';

export interface CacheHealthCardProps {
  cacheVerification: CacheVerificationResult | null;
  isLoading: boolean;
  isVerifying: boolean;
  isRepairing: boolean;
  totalIssues: number;
  handleVerify: () => void;
  handleRepair: () => void;
}

export function CacheHealthCard({
  cacheVerification,
  isLoading,
  isVerifying,
  isRepairing,
  totalIssues,
  handleVerify,
  handleRepair,
}: CacheHealthCardProps) {
  const { t } = useLocale();

  const isHealthy = cacheVerification?.is_healthy ?? true;
  const hasRun = cacheVerification !== null;

  return (
    <Card className={cn(
      'transition-colors',
      hasRun && isHealthy && 'border-green-200 dark:border-green-900/50',
      hasRun && !isHealthy && 'border-amber-200 dark:border-amber-900/50',
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <CardTitle className="text-sm">{t('cache.cacheHealth')}</CardTitle>
            {hasRun && (
              <Badge
                variant={isHealthy ? 'default' : 'destructive'}
                className={cn(
                  'ml-1 gap-1',
                  isHealthy && 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400',
                )}
              >
                {isHealthy ? (
                  <>
                    <ShieldCheck className="h-3 w-3" />
                    {t('cache.healthy')}
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3 w-3" />
                    {t('cache.unhealthy')}
                  </>
                )}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleVerify}
              disabled={isLoading}
            >
              <Shield className={cn('h-3 w-3 mr-1', isVerifying && 'animate-pulse')} />
              {isVerifying ? t('cache.verifying') : t('cache.verify')}
            </Button>
            {hasRun && !isHealthy && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleRepair}
                disabled={isLoading}
              >
                <Wrench className={cn('h-3 w-3 mr-1', isRepairing && 'animate-spin')} />
                {isRepairing ? t('cache.repairing') : t('cache.repair')}
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">{t('cache.cacheHealthDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasRun ? (
          <div className="space-y-3">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-2.5 text-center">
                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-700 dark:text-green-400">
                  {cacheVerification!.valid_entries}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">{t('cache.validEntries')}</p>
              </div>
              <div className={cn(
                'rounded-lg p-2.5 text-center',
                cacheVerification!.missing_files > 0
                  ? 'bg-red-50 dark:bg-red-950/30'
                  : 'bg-muted/50',
              )}>
                <XCircle className={cn('h-4 w-4 mx-auto mb-1', cacheVerification!.missing_files > 0 ? 'text-red-500' : 'text-muted-foreground')} />
                <p className={cn('text-lg font-bold', cacheVerification!.missing_files > 0 ? 'text-red-700 dark:text-red-400' : '')}>
                  {cacheVerification!.missing_files}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">{t('cache.missingFiles')}</p>
              </div>
              <div className={cn(
                'rounded-lg p-2.5 text-center',
                cacheVerification!.corrupted_files > 0
                  ? 'bg-orange-50 dark:bg-orange-950/30'
                  : 'bg-muted/50',
              )}>
                <AlertTriangle className={cn('h-4 w-4 mx-auto mb-1', cacheVerification!.corrupted_files > 0 ? 'text-orange-500' : 'text-muted-foreground')} />
                <p className={cn('text-lg font-bold', cacheVerification!.corrupted_files > 0 ? 'text-orange-700 dark:text-orange-400' : '')}>
                  {cacheVerification!.corrupted_files}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">{t('cache.corruptedFiles')}</p>
              </div>
              <div className={cn(
                'rounded-lg p-2.5 text-center',
                cacheVerification!.size_mismatches > 0
                  ? 'bg-yellow-50 dark:bg-yellow-950/30'
                  : 'bg-muted/50',
              )}>
                <AlertCircle className={cn('h-4 w-4 mx-auto mb-1', cacheVerification!.size_mismatches > 0 ? 'text-yellow-500' : 'text-muted-foreground')} />
                <p className={cn('text-lg font-bold', cacheVerification!.size_mismatches > 0 ? 'text-yellow-700 dark:text-yellow-400' : '')}>
                  {cacheVerification!.size_mismatches}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">{t('cache.sizeMismatches')}</p>
              </div>
            </div>

            {/* Issue Details */}
            {cacheVerification!.details.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs">
                    {t('cache.issueDetails')} ({totalIssues})
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <ScrollArea className="max-h-40">
                    <div className="rounded-md border">
                      {cacheVerification!.details.map((issue, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 text-xs border-b last:border-b-0">
                          <AlertTriangle className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{issue.entry_key}</p>
                            <p className="text-muted-foreground">{issue.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('cache.noIssues')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

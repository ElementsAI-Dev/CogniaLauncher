'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle className="text-base">{t('cache.cacheHealth')}</CardTitle>
            {cacheVerification && (
              <Badge variant={cacheVerification.is_healthy ? 'default' : 'destructive'} className="ml-2">
                {cacheVerification.is_healthy ? (
                  <>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {t('cache.healthy')}
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    {t('cache.unhealthy')}
                  </>
                )}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={isLoading}
            >
              <Shield className={`h-4 w-4 mr-2 ${isVerifying ? 'animate-pulse' : ''}`} />
              {isVerifying ? t('cache.verifying') : t('cache.verify')}
            </Button>
            {cacheVerification && !cacheVerification.is_healthy && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRepair}
                disabled={isLoading}
              >
                <Wrench className={`h-4 w-4 mr-2 ${isRepairing ? 'animate-spin' : ''}`} />
                {isRepairing ? t('cache.repairing') : t('cache.repair')}
              </Button>
            )}
          </div>
        </div>
        <CardDescription>{t('cache.cacheHealthDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {cacheVerification ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium">{cacheVerification.valid_entries}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.validEntries')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className={`h-4 w-4 ${cacheVerification.missing_files > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">{cacheVerification.missing_files}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.missingFiles')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${cacheVerification.corrupted_files > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">{cacheVerification.corrupted_files}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.corruptedFiles')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className={`h-4 w-4 ${cacheVerification.size_mismatches > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">{cacheVerification.size_mismatches}</p>
                  <p className="text-xs text-muted-foreground">{t('cache.sizeMismatches')}</p>
                </div>
              </div>
            </div>

            {cacheVerification.details.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    {t('cache.issueDetails')} ({totalIssues})
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="rounded-md border max-h-48 overflow-y-auto">
                    {cacheVerification.details.map((issue, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 text-sm border-b last:border-b-0">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{issue.entry_key}</p>
                          <p className="text-muted-foreground text-xs">{issue.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('cache.noIssues')}</p>
        )}
      </CardContent>
    </Card>
  );
}

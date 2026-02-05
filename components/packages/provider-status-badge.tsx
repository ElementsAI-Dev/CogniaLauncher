'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Server,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { ProviderInfo } from '@/lib/tauri';
import * as tauri from '@/lib/tauri';
import { toast } from 'sonner';
import Link from 'next/link';

interface ProviderStatusBadgeProps {
  providers: ProviderInfo[];
  onProviderToggle?: (providerId: string, enabled: boolean) => void;
  onRefresh?: () => void;
}

export function ProviderStatusBadge({
  providers,
  onProviderToggle,
  onRefresh,
}: ProviderStatusBadgeProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({});
  const [providerAvailability, setProviderAvailability] = useState<Record<string, boolean>>({});

  const enabledCount = useMemo(
    () => providers.filter((p) => p.enabled).length,
    [providers]
  );

  const availableCount = useMemo(
    () =>
      providers.filter(
        (p) => p.enabled && providerAvailability[p.id] !== false
      ).length,
    [providers, providerAvailability]
  );

  const handleToggle = useCallback(
    async (providerId: string, enabled: boolean) => {
      setTogglingProvider(providerId);
      try {
        if (enabled) {
          await tauri.providerEnable(providerId);
        } else {
          await tauri.providerDisable(providerId);
        }
        onProviderToggle?.(providerId, enabled);
        const provider = providers.find((p) => p.id === providerId);
        toast.success(
          enabled
            ? t('providers.enableSuccess', { name: provider?.display_name || providerId })
            : t('providers.disableSuccess', { name: provider?.display_name || providerId })
        );
        onRefresh?.();
      } catch {
        toast.error(
          enabled
            ? t('providers.enableError', { name: providerId })
            : t('providers.disableError', { name: providerId })
        );
      } finally {
        setTogglingProvider(null);
      }
    },
    [providers, onProviderToggle, onRefresh, t]
  );

  const handleCheckStatus = useCallback(async (providerId: string) => {
    setCheckingStatus((prev) => ({ ...prev, [providerId]: true }));
    try {
      const available = await tauri.providerCheck(providerId);
      setProviderAvailability((prev) => ({ ...prev, [providerId]: available }));
    } finally {
      setCheckingStatus((prev) => ({ ...prev, [providerId]: false }));
    }
  }, []);

  const packageProviders = useMemo(
    () => providers.filter((p) => !p.is_environment_provider),
    [providers]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Server className="h-4 w-4" />
          <span className="hidden sm:inline">{t('packages.providers')}</span>
          <Badge
            variant={availableCount > 0 ? 'default' : 'secondary'}
            className="ml-1 text-xs"
          >
            {enabledCount}/{providers.length}
          </Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" collisionPadding={16}>
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{t('packages.providerManagement')}</h4>
            <Link href="/providers" className="text-xs text-primary hover:underline flex items-center gap-1">
              {t('packages.viewAll')}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('packages.providerManagementDesc')}
          </p>
        </div>

        <ScrollArea className="max-h-[min(300px,50vh)]">
          <div className="p-2 space-y-1">
            {packageProviders.map((provider) => {
              const isToggling = togglingProvider === provider.id;
              const isChecking = checkingStatus[provider.id];
              const availability = providerAvailability[provider.id];

              return (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                      {isChecking ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : availability === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : availability === false ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Server className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Label
                        htmlFor={`provider-${provider.id}`}
                        className="text-sm font-medium truncate block cursor-pointer"
                      >
                        {provider.display_name}
                      </Label>
                      <span className="text-xs text-muted-foreground font-mono">
                        {provider.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleCheckStatus(provider.id)}
                      disabled={isChecking || !provider.enabled}
                    >
                      {isChecking ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        t('providers.checkStatus')
                      )}
                    </Button>
                    <Switch
                      id={`provider-${provider.id}`}
                      checked={provider.enabled}
                      onCheckedChange={(checked) => handleToggle(provider.id, checked)}
                      disabled={isToggling}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              packageProviders.forEach((p) => {
                if (p.enabled) {
                  handleCheckStatus(p.id);
                }
              });
            }}
          >
            {t('providers.checkAllStatus')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

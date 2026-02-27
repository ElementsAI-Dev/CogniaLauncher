'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/components/providers/locale-provider';
import { useWslStatus } from '@/hooks/use-wsl-status';
import { Terminal, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export function WslStatusWidget() {
  const { t } = useLocale();
  const { available, distros, status, runningCount } = useWslStatus();

  if (available === false) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-sm text-muted-foreground">
            <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t('wsl.notAvailable')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t('wsl.title')}
        </CardTitle>
        <CardDescription>
          {t('wsl.kernelVersion')}: {status?.version ?? '—'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 grid-cols-2 mb-3">
          <div className="text-center rounded-md border p-2.5">
            <p className="text-2xl font-bold">{distros.length}</p>
            <p className="text-xs text-muted-foreground">{t('wsl.distros')}</p>
          </div>
          <div className="text-center rounded-md border p-2.5">
            <p className="text-2xl font-bold text-green-600">{runningCount}</p>
            <p className="text-xs text-muted-foreground">{t('wsl.running')}</p>
          </div>
        </div>

        {distros.length > 0 && (
          <>
            <Separator className="mb-3" />
            <div className="space-y-1.5">
              {distros.slice(0, 4).map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm px-1">
                  <span className="truncate font-medium">{d.name}</span>
                  <Badge
                    variant={d.state.toLowerCase() === 'running' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {d.state.toLowerCase() === 'running' ? t('wsl.running') : t('wsl.stopped')}
                  </Badge>
                </div>
              ))}
              {distros.length > 4 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{distros.length - 4} {t('common.more')}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
          <Link href="/wsl">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('wsl.title')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

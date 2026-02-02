'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Scale, ShieldCheck, Copyright } from 'lucide-react';

interface LicenseCardProps {
  t: (key: string) => string;
}

export function LicenseCard({ t }: LicenseCardProps) {
  return (
    <Card className="rounded-xl border bg-card" role="region" aria-labelledby="license-heading">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="license-heading" className="text-base font-semibold text-foreground">
            {t('about.licenseCertificates')}
          </span>
        </div>
        
        <div className="space-y-3">
          {/* MIT License Row */}
          <a
            href="https://opensource.org/licenses/MIT"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            aria-label={`${t('about.mitLicense')} - ${t('about.openInNewTab')}`}
          >
            <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {t('about.mitLicense')}
              </span>
              <span className="text-xs text-green-700 dark:text-green-300">
                {t('about.mitLicenseDesc')}
              </span>
            </div>
          </a>
          
          {/* Copyright Row */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <Copyright className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{t('about.copyright')}</span>
              <span className="text-xs text-muted-foreground">{t('about.copyrightDesc')}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

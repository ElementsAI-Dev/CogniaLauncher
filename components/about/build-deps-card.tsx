'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Blocks } from 'lucide-react';
import { BUILD_DEPENDENCIES } from '@/lib/constants/about';
import { useTheme } from 'next-themes';

interface BuildDepsCardProps {
  t: (key: string) => string;
}

export function BuildDepsCard({ t }: BuildDepsCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Card className="rounded-xl border bg-card" role="region" aria-labelledby="build-deps-heading">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Blocks className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="build-deps-heading" className="text-base font-semibold text-foreground">
            {t('about.buildDependencies')}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {BUILD_DEPENDENCIES.slice(0, 2).map((dep) => (
              <a
                key={dep.name}
                href={dep.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label={`${dep.name} ${dep.version} - ${t('about.openInNewTab')}`}
              >
                <div
                  className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold flex-shrink-0"
                  style={{
                    backgroundColor: isDark ? dep.darkColor : dep.color,
                    color: isDark ? dep.darkTextColor : dep.textColor,
                  }}
                  aria-hidden="true"
                >
                  {dep.letter}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-foreground">{dep.name}</span>
                  <span className="text-[11px] text-muted-foreground">{dep.version}</span>
                </div>
              </a>
            ))}
          </div>
          
          <div className="space-y-2">
            {BUILD_DEPENDENCIES.slice(2, 4).map((dep) => (
              <a
                key={dep.name}
                href={dep.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label={`${dep.name} ${dep.version} - ${t('about.openInNewTab')}`}
              >
                <div
                  className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold flex-shrink-0"
                  style={{
                    backgroundColor: isDark ? dep.darkColor : dep.color,
                    color: isDark ? dep.darkTextColor : dep.textColor,
                  }}
                  aria-hidden="true"
                >
                  {dep.letter}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-foreground">{dep.name}</span>
                  <span className="text-[11px] text-muted-foreground">{dep.version}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

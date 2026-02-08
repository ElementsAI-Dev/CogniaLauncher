'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/components/providers/locale-provider';
import {
  Layers,
  Package,
  Settings,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WelcomeWidgetProps {
  hasEnvironments: boolean;
  hasPackages: boolean;
  className?: string;
}

export function WelcomeWidget({ hasEnvironments, hasPackages, className }: WelcomeWidgetProps) {
  const { t } = useLocale();
  const router = useRouter();

  // Don't show if user already has both environments and packages
  if (hasEnvironments && hasPackages) return null;

  const steps = [
    {
      id: 'environments',
      icon: Layers,
      title: t('dashboard.widgets.welcomeStep1Title'),
      description: t('dashboard.widgets.welcomeStep1Desc'),
      done: hasEnvironments,
      href: '/environments',
    },
    {
      id: 'packages',
      icon: Package,
      title: t('dashboard.widgets.welcomeStep2Title'),
      description: t('dashboard.widgets.welcomeStep2Desc'),
      done: hasPackages,
      href: '/packages',
    },
    {
      id: 'settings',
      icon: Settings,
      title: t('dashboard.widgets.welcomeStep3Title'),
      description: t('dashboard.widgets.welcomeStep3Desc'),
      done: false,
      href: '/settings',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              {t('dashboard.widgets.welcomeTitle')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.widgets.welcomeProgress', { done: completedCount, total: steps.length })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercent} className="h-1.5 mb-4" />

        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={() => router.push(step.href)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 text-left"
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  step.done
                    ? 'bg-green-100 text-green-600 dark:bg-green-950/50'
                    : 'bg-muted text-muted-foreground',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm font-medium',
                      step.done && 'line-through text-muted-foreground',
                    )}>
                      {step.title}
                    </span>
                    {step.done && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{step.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

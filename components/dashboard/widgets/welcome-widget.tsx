'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/components/providers/locale-provider';
import {
  Layers,
  Package,
  Settings,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Map,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/lib/stores/onboarding';
import { DashboardClickableRow } from '@/components/dashboard/dashboard-primitives';

interface WelcomeWidgetProps {
  hasEnvironments: boolean;
  hasPackages: boolean;
  className?: string;
}

export function WelcomeWidget({ hasEnvironments, hasPackages, className }: WelcomeWidgetProps) {
  const { t } = useLocale();
  const router = useRouter();
  const { completed: onboardingCompleted, tourCompleted, startTour } = useOnboardingStore();

  if (hasEnvironments && hasPackages) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {t('dashboard.widgets.workspaceReadyTitle')}
              </CardTitle>
              <CardDescription>
                {t('dashboard.widgets.workspaceReadyDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              className="justify-between"
              onClick={() => router.push('/environments')}
            >
              {t('dashboard.widgets.welcomeReviewEnvironments')}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              className="justify-between"
              onClick={() => router.push('/packages')}
            >
              {t('dashboard.widgets.welcomeReviewPackages')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {!onboardingCompleted && (
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push('/settings')}
            >
              {t('dashboard.quickActions.openSettings')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {!tourCompleted && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2"
              onClick={startTour}
            >
              <Map className="h-4 w-4" />
              {t('dashboard.widgets.welcomeTakeTour')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

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
      done: onboardingCompleted,
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
              <DashboardClickableRow
                key={step.id}
                onClick={() => router.push(step.href)}
                className="items-center gap-3"
                aria-label={step.title}
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
              </DashboardClickableRow>
            );
          })}
        </div>

        {/* Guided Tour shortcut */}
        {!tourCompleted && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 gap-2"
            onClick={startTour}
          >
            <Map className="h-4 w-4" />
            {t('dashboard.widgets.welcomeTakeTour')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

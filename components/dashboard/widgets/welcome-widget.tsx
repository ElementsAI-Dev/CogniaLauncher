'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/components/providers/locale-provider';
import {
  Layers,
  Package,
  Settings,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

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

  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{t('dashboard.widgets.welcomeTitle')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.widgets.welcomeProgress', { done: completedCount, total: steps.length })}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted mb-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={() => router.push(step.href)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 text-left"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${step.done ? 'bg-green-100 text-green-600 dark:bg-green-950/50' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                      {step.title}
                    </span>
                    {step.done && (
                      <span className="text-green-600 text-xs">✓</span>
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

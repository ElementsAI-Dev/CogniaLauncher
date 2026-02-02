'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Package, Terminal, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onAddEnvironment: () => void;
  t: (key: string, params?: Record<string, string>) => string;
}

export function EmptyState({ onAddEnvironment, t }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          {/* Illustration */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-semibold">
              {t('environments.emptyState.title') || 'No Environments Configured'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('environments.noEnvironments')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onAddEnvironment} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('environments.addEnvironment')}
            </Button>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 w-full max-w-2xl">
            <FeatureCard
              icon={<Terminal className="h-5 w-5" />}
              title={t('environments.emptyState.feature1Title') || 'Version Management'}
              description={t('environments.emptyState.feature1Desc') || 'Install and switch between versions easily'}
            />
            <FeatureCard
              icon={<Package className="h-5 w-5" />}
              title={t('environments.emptyState.feature2Title') || 'Multiple Languages'}
              description={t('environments.emptyState.feature2Desc') || 'Support for Node.js, Python, Go, Rust & more'}
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title={t('environments.emptyState.feature3Title') || 'Auto Detection'}
              description={t('environments.emptyState.feature3Desc') || 'Automatically detect project versions'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/30">
      <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center mb-2 text-primary">
        {icon}
      </div>
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

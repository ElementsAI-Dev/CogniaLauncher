'use client';

import { Suspense, use, useCallback, useEffect, type ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EnvironmentErrorBoundary } from '@/components/environments/environment-error-boundary';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { getToolById } from '@/lib/constants/toolbox';
import type { ToolComponentProps } from '@/types/toolbox';

export function ToolLoadingFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

const componentCache = new Map<string, Promise<ComponentType<ToolComponentProps>>>();

function loadBuiltInComponent(builtInId: string): Promise<ComponentType<ToolComponentProps>> {
  const cached = componentCache.get(builtInId);
  if (cached) return cached;

  const tool = getToolById(builtInId);
  if (!tool) {
    const empty = Promise.resolve((() => null) as unknown as ComponentType<ToolComponentProps>);
    componentCache.set(builtInId, empty);
    return empty;
  }

  const promise = tool.component().then((mod) => mod.default);
  componentCache.set(builtInId, promise);
  return promise;
}

function BuiltInToolRendererInner({
  builtInId,
  onReady,
}: {
  builtInId: string;
  onReady?: () => void;
}) {
  /* eslint-disable -- dynamic component loaded from module-level promise cache */
  const Component = use(loadBuiltInComponent(builtInId));
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  if (!Component) return null;
  return <Component />;
  /* eslint-enable */
}

export function BuiltInToolRenderer({ builtInId }: { builtInId: string }) {
  const { t } = useLocale();
  const setToolLifecycle = useToolboxStore((state) => state.setToolLifecycle);
  const clearToolLifecycle = useToolboxStore((state) => state.clearToolLifecycle);
  const unifiedToolId = `builtin:${builtInId}`;

  useEffect(() => {
    setToolLifecycle(unifiedToolId, 'prepare');
    return () => clearToolLifecycle(unifiedToolId);
  }, [unifiedToolId, setToolLifecycle, clearToolLifecycle]);

  const handleReady = useCallback(() => {
    setToolLifecycle(unifiedToolId, 'postProcess');
    setToolLifecycle(unifiedToolId, 'success');
  }, [setToolLifecycle, unifiedToolId]);

  return (
    <EnvironmentErrorBoundary
      fallbackTitle={t('toolbox.errorBoundary.title')}
      fallbackDescription={t('toolbox.errorBoundary.description')}
      retryLabel={t('toolbox.errorBoundary.retry')}
    >
      <Suspense fallback={<ToolLoadingFallback />}>
        <BuiltInToolRendererInner builtInId={builtInId} onReady={handleReady} />
      </Suspense>
    </EnvironmentErrorBoundary>
  );
}

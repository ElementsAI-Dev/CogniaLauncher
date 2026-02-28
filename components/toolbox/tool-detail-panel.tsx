'use client';

import { Suspense, use, type ComponentType } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import { getToolById } from '@/lib/constants/toolbox';
import { PluginToolRunner } from '@/components/toolbox/plugin-tool-runner';
import { Button } from '@/components/ui/button';
import { Plug, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import type { ToolComponentProps } from '@/types/toolbox';
import type { UnifiedTool } from '@/hooks/use-toolbox';

interface ToolDetailPanelProps {
  tool: UnifiedTool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ToolLoadingFallback() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// Module-level cache for built-in tool component promises
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

function BuiltInToolRenderer({ builtInId }: { builtInId: string }) {
  /* eslint-disable -- dynamic component loaded from module-level promise cache */
  const Component = use(loadBuiltInComponent(builtInId));
  if (!Component) return null;
  return <Component />;
  /* eslint-enable */
}

export function ToolDetailPanel({ tool, open, onOpenChange }: ToolDetailPanelProps) {
  const { t } = useLocale();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] sm:w-[700px] md:w-[800px] overflow-y-auto">
        {tool ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {tool.name}
                {!tool.isBuiltIn && (
                  <Badge variant="outline" className="text-[10px] gap-0.5">
                    <Plug className="h-2.5 w-2.5" />
                    {t('toolbox.plugin.external')}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>{tool.description}</SheetDescription>
            </SheetHeader>
            <div className="mt-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild onClick={() => onOpenChange(false)}>
                <Link href={`/toolbox/${tool.isBuiltIn && tool.builtInDef ? tool.builtInDef.id : encodeURIComponent(tool.id)}`}>
                  <Maximize2 className="h-3.5 w-3.5" />
                  {t('toolbox.actions.openFullPage')}
                </Link>
              </Button>
            </div>
            <div className="mt-6">
              {tool.isBuiltIn && tool.builtInDef ? (
                <Suspense fallback={<ToolLoadingFallback />}>
                  <BuiltInToolRenderer builtInId={tool.builtInDef.id} />
                </Suspense>
              ) : tool.pluginTool ? (
                <PluginToolRunner tool={tool.pluginTool} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {t('toolbox.search.noResults')}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {t('toolbox.search.noResults')}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

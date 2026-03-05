'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { PluginToolRunner } from '@/components/toolbox/plugin-tool-runner';
import { BuiltInToolRenderer } from '@/components/toolbox/built-in-tool-renderer';
import { Button } from '@/components/ui/button';
import { Plug, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import type { UnifiedTool } from '@/hooks/use-toolbox';

interface ToolDetailPanelProps {
  tool: UnifiedTool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolDetailPanel({ tool, open, onOpenChange }: ToolDetailPanelProps) {
  const { t } = useLocale();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="tool-detail-panel-content"
        className="w-[min(94vw,980px)] max-w-none gap-0 overflow-hidden p-0 sm:w-[min(88vw,980px)] sm:max-w-none md:w-[min(82vw,980px)]"
      >
        {tool ? (
          <div className="flex h-full min-h-0 flex-col">
            <div data-testid="tool-detail-panel-header" className="border-b bg-muted/20">
              <SheetHeader className="gap-2 px-6 pb-3 pt-6">
                <SheetTitle className="flex items-center gap-2 text-base leading-tight">
                  {tool.name}
                  {!tool.isBuiltIn && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Plug className="h-3 w-3" />
                      {t('toolbox.plugin.external')}
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription className="leading-relaxed">{tool.description}</SheetDescription>
              </SheetHeader>
              <div data-testid="tool-detail-panel-actions" className="px-6 pb-4">
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href={`/toolbox/tool?id=${encodeURIComponent(tool.id)}`} onClick={() => onOpenChange(false)}>
                    <Maximize2 className="h-3.5 w-3.5" />
                    {t('toolbox.actions.openFullPage')}
                  </Link>
                </Button>
              </div>
            </div>

            <div data-testid="tool-detail-panel-body" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              {tool.isBuiltIn && tool.builtInDef ? (
                <BuiltInToolRenderer builtInId={tool.builtInDef.id} />
              ) : tool.pluginTool ? (
                <PluginToolRunner tool={tool.pluginTool} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {t('toolbox.search.noResults')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-muted-foreground">
            {t('toolbox.search.noResults')}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

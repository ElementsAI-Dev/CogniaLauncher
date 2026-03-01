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
                <Link href={`/toolbox/tool?id=${encodeURIComponent(tool.id)}`}>
                  <Maximize2 className="h-3.5 w-3.5" />
                  {t('toolbox.actions.openFullPage')}
                </Link>
              </Button>
            </div>
            <div className="mt-6">
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

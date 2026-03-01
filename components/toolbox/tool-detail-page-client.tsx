'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolbox } from '@/hooks/use-toolbox';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { PluginToolRunner } from '@/components/toolbox/plugin-tool-runner';
import { BuiltInToolRenderer } from '@/components/toolbox/built-in-tool-renderer';
import { ArrowLeft, Plug } from 'lucide-react';
import Link from 'next/link';

export function ToolDetailPageClient({ toolId }: { toolId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const addRecent = useToolboxStore((s) => s.addRecent);
  const { allTools } = useToolbox();

  const tool = useMemo(() => {
    if (!toolId) return undefined;
    const exact = allTools.find((t) => t.id === toolId);
    if (exact) return exact;
    return allTools.find((t) => t.isBuiltIn && t.builtInDef?.id === toolId);
  }, [toolId, allTools]);

  useEffect(() => {
    if (tool) addRecent(tool.id);
  }, [tool, addRecent]);

  if (!tool) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title={t('toolbox.title')} />
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p>{t('toolbox.search.noResults')}</p>
          <Button variant="link" className="mt-2" onClick={() => router.push('/toolbox')}>
            {t('toolbox.actions.backToToolbox')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {tool.name}
            {!tool.isBuiltIn && (
              <Badge variant="outline" className="text-xs gap-0.5">
                <Plug className="h-3 w-3" />
                {t('toolbox.plugin.external')}
              </Badge>
            )}
          </span>
        }
        description={tool.description}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/toolbox">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('toolbox.actions.backToToolbox')}
            </Link>
          </Button>
        }
      />

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
  );
}

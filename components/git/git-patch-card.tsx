'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDiff } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { GitPatchCardProps } from '@/types/git';

export function GitPatchCard({
  loading,
  onFormatPatch,
  onApplyPatch,
  onApplyMailbox,
}: GitPatchCardProps) {
  const { t } = useLocale();
  const [range, setRange] = useState('HEAD~3..HEAD');
  const [outputDir, setOutputDir] = useState('');
  const [patchFile, setPatchFile] = useState('');
  const [checkOnly, setCheckOnly] = useState(false);
  const [createdPatches, setCreatedPatches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const disabled = loading || busy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileDiff className="h-4 w-4" />
          {t('git.patch.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create" className="space-y-3">
          <TabsList>
            <TabsTrigger value="create">{t('git.patch.createTab')}</TabsTrigger>
            <TabsTrigger value="apply">{t('git.patch.applyTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="space-y-2">
            <Input
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder={t('git.patch.rangePlaceholder')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder={t('git.patch.outputDir')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || !range.trim() || !outputDir.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const files = await onFormatPatch(range.trim(), outputDir.trim());
                  setCreatedPatches(files);
                  toast.success(t('git.patch.createSuccess', { count: String(files.length) }));
                } catch (e) {
                  toast.error(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('git.patch.create')}
            </Button>
            {createdPatches.length > 0 && (
              <div className="space-y-1">
                {createdPatches.map((item) => (
                  <code key={item} className="block text-xs font-mono text-muted-foreground">
                    {item}
                  </code>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="apply" className="space-y-2">
            <Input
              value={patchFile}
              onChange={(e) => setPatchFile(e.target.value)}
              placeholder={t('git.patch.patchFile')}
              className="h-7 text-xs font-mono"
              disabled={disabled}
            />
            <label className="inline-flex items-center gap-2 text-xs">
              <Checkbox checked={checkOnly} onCheckedChange={(v) => setCheckOnly(v === true)} />
              <span>{t('git.patch.checkOnly')}</span>
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={disabled || !patchFile.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const msg = await onApplyPatch(patchFile.trim(), checkOnly);
                    toast.success(checkOnly ? t('git.patch.checkSuccess') : t('git.patch.applySuccess'), { description: msg });
                  } catch (e) {
                    toast.error(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('git.patch.apply')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={disabled || !patchFile.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const msg = await onApplyMailbox(patchFile.trim());
                    toast.success(t('git.patch.applySuccess'), { description: msg });
                  } catch (e) {
                    toast.error(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('git.patch.applyMailbox')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

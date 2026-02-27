'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GitMerge, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitMergeDialogProps } from '@/types/git';

export function GitMergeDialog({ branches, currentBranch, onMerge }: GitMergeDialogProps) {
  const { t } = useLocale();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [noFf, setNoFf] = useState(false);
  const [loading, setLoading] = useState(false);

  const mergeable = branches
    .filter((b) => !b.isRemote && b.name !== currentBranch)
    .map((b) => b.name);

  const handleMerge = async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      await onMerge(selectedBranch, noFf);
      setSelectedBranch('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitMerge className="h-4 w-4" />
          {t('git.mergeAction.title')}
        </CardTitle>
        {currentBranch && (
          <CardDescription className="text-xs">
            {t('git.mergeAction.currentBranch')}: <code className="font-mono">{currentBranch}</code>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('git.mergeAction.selectBranch')} />
            </SelectTrigger>
            <SelectContent>
              {mergeable.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="no-ff"
                checked={noFf}
                onCheckedChange={(checked) => setNoFf(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="no-ff" className="text-xs text-muted-foreground cursor-pointer">
                {t('git.mergeAction.noFf')}
              </Label>
            </div>
            <Button
              size="sm"
              onClick={handleMerge}
              disabled={loading || !selectedBranch}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <GitMerge className="h-3.5 w-3.5 mr-1" />
              )}
              {t('git.actions.merge')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

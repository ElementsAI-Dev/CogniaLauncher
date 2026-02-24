'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FolderOpen } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';

interface GitRepoSelectorProps {
  repoPath: string | null;
  onSelect: (path: string) => Promise<void>;
  loading: boolean;
}

export function GitRepoSelector({ repoPath, onSelect, loading }: GitRepoSelectorProps) {
  const { t } = useLocale();
  const [inputPath, setInputPath] = useState(repoPath || '');

  const handleBrowse = async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setInputPath(selected);
        await onSelect(selected);
      }
    } catch {
      // Dialog cancelled or not available
    }
  };

  const handleSubmit = async () => {
    if (inputPath.trim()) {
      await onSelect(inputPath.trim());
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder={t('git.repo.selectRepo')}
        value={inputPath}
        onChange={(e) => setInputPath(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className="flex-1 font-mono text-xs"
        disabled={loading}
      />
      <Button variant="outline" size="sm" onClick={handleBrowse} disabled={loading}>
        <FolderOpen className="h-4 w-4 mr-1" />
        {t('git.repo.browse')}
      </Button>
    </div>
  );
}

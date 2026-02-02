'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Loader2 } from 'lucide-react';

interface VersionInstallFormProps {
  onInstall: (version: string) => Promise<void>;
  isInstalling: boolean;
  t: (key: string, params?: Record<string, string>) => string;
}

export function VersionInstallForm({ 
  onInstall, 
  isInstalling,
  t 
}: VersionInstallFormProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>('latest');
  const [customVersion, setCustomVersion] = useState('');

  const handleInstall = async () => {
    const version = selectedVersion === 'custom' ? customVersion : selectedVersion;
    if (version) {
      await onInstall(version);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t('environments.installNewVersion')}
      </p>
      <div className="flex gap-2">
        <Select value={selectedVersion} onValueChange={setSelectedVersion}>
          <SelectTrigger className="flex-1 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">{t('environments.latest')}</SelectItem>
            <SelectItem value="lts">{t('environments.lts')}</SelectItem>
            <SelectItem value="custom">{t('environments.selectVersion')}</SelectItem>
          </SelectContent>
        </Select>
        {selectedVersion === 'custom' && (
          <Input
            value={customVersion}
            onChange={(e) => setCustomVersion(e.target.value)}
            placeholder={t('environments.versionPlaceholder')}
            className="flex-1 h-9"
          />
        )}
        <Button
          size="sm"
          onClick={handleInstall}
          disabled={isInstalling || (selectedVersion === 'custom' && !customVersion)}
          className="h-9 gap-1"
        >
          {isInstalling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {t('environments.quickInstall')}
        </Button>
      </div>
    </div>
  );
}

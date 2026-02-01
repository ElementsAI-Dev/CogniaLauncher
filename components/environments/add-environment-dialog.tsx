'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/components/providers/locale-provider';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { cn } from '@/lib/utils';
import { X, Check } from 'lucide-react';

const LANGUAGES = [
  { id: 'node', name: 'Node.js', icon: '🟢', color: 'bg-green-50 border-green-500' },
  { id: 'python', name: 'Python', icon: '🐍', color: 'bg-blue-50 border-blue-500' },
  { id: 'go', name: 'Go', icon: '🔵', color: 'bg-cyan-50 border-cyan-500' },
  { id: 'rust', name: 'Rust', icon: '🦀', color: 'bg-orange-50 border-orange-500' },
  { id: 'ruby', name: 'Ruby', icon: '💎', color: 'bg-red-50 border-red-500' },
  { id: 'java', name: 'Java', icon: '☕', color: 'bg-amber-50 border-amber-500' },
  { id: 'php', name: 'PHP', icon: '🐘', color: 'bg-purple-50 border-purple-500' },
  { id: 'dotnet', name: '.NET', icon: '🔷', color: 'bg-violet-50 border-violet-500' },
];

const PROVIDERS: Record<string, { id: string; name: string; description: string }[]> = {
  node: [
    { id: 'fnm', name: 'fnm', description: 'Fast Node Manager (Recommended)' },
    { id: 'nvm', name: 'nvm', description: 'Node Version Manager' },
  ],
  python: [
    { id: 'pyenv', name: 'pyenv', description: 'Python version management' },
  ],
  go: [
    { id: 'goenv', name: 'goenv', description: 'Go version management' },
  ],
  rust: [
    { id: 'rustup', name: 'rustup', description: 'Rust toolchain installer' },
  ],
  ruby: [
    { id: 'rbenv', name: 'rbenv', description: 'Ruby version management' },
  ],
  java: [
    { id: 'sdkman', name: 'SDKMAN!', description: 'Software Development Kit Manager' },
  ],
  php: [
    { id: 'phpbrew', name: 'phpbrew', description: 'PHP version manager' },
  ],
  dotnet: [
    { id: 'dotnet', name: 'dotnet', description: '.NET SDK' },
  ],
};

interface AddEnvironmentDialogProps {
  onAdd?: (language: string, provider: string, version: string) => Promise<void>;
}

export function AddEnvironmentDialog({ onAdd }: AddEnvironmentDialogProps) {
  const { t } = useLocale();
  const { addDialogOpen, closeAddDialog } = useEnvironmentStore();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [versionType, setVersionType] = useState<'lts' | 'latest' | 'specific'>('lts');
  const [specificVersion, setSpecificVersion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLanguageSelect = (langId: string) => {
    setSelectedLanguage(langId);
    const providers = PROVIDERS[langId];
    if (providers && providers.length > 0) {
      setSelectedProvider(providers[0].id);
    }
  };

  const handleSubmit = async () => {
    if (!selectedLanguage || !selectedProvider) return;
    
    setIsSubmitting(true);
    try {
      const version = versionType === 'specific' ? specificVersion : versionType;
      await onAdd?.(selectedLanguage, selectedProvider, version);
      handleClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedLanguage(null);
    setSelectedProvider('');
    setVersionType('lts');
    setSpecificVersion('');
    closeAddDialog();
  };

  const providers = selectedLanguage ? PROVIDERS[selectedLanguage] || [] : [];

  return (
    <Dialog open={addDialogOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{t('environments.addDialog.title')}</DialogTitle>
              <DialogDescription>{t('environments.addDialog.description')}</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Language Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('environments.addDialog.selectLanguage')}</Label>
            <div className="grid grid-cols-4 gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageSelect(lang.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    'hover:bg-accent',
                    selectedLanguage === lang.id
                      ? lang.color + ' border-2'
                      : 'border-border bg-background'
                  )}
                >
                  <span className="text-2xl">{lang.icon}</span>
                  <span className="text-sm font-medium">{lang.name}</span>
                  {selectedLanguage === lang.id && (
                    <Check className="h-4 w-4 text-primary absolute top-2 right-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Provider Selection */}
          {selectedLanguage && providers.length > 0 && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">{t('environments.addDialog.versionManager')}</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('environments.addDialog.versionManagerDesc')}
                </p>
              </div>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{provider.name}</span>
                        <span className="text-xs text-muted-foreground">{provider.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Version Selection */}
          {selectedLanguage && selectedProvider && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">{t('environments.addDialog.selectVersion')}</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('environments.addDialog.selectVersionDesc')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={versionType === 'lts' ? 'default' : 'outline'}
                  onClick={() => setVersionType('lts')}
                  className="flex-1"
                >
                  {t('environments.addDialog.latestLts')}
                </Button>
                <Button
                  type="button"
                  variant={versionType === 'latest' ? 'default' : 'outline'}
                  onClick={() => setVersionType('latest')}
                  className="flex-1"
                >
                  {t('environments.addDialog.latestStable')}
                </Button>
                <Button
                  type="button"
                  variant={versionType === 'specific' ? 'default' : 'outline'}
                  onClick={() => setVersionType('specific')}
                  className="flex-1"
                >
                  {t('environments.addDialog.specific')}
                </Button>
              </div>
              {versionType === 'specific' && (
                <Input
                  placeholder={t('environments.versionPlaceholder')}
                  value={specificVersion}
                  onChange={(e) => setSpecificVersion(e.target.value)}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('environments.addDialog.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedLanguage || !selectedProvider || isSubmitting || (versionType === 'specific' && !specificVersion)}
          >
            {t('environments.addDialog.addEnvironment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

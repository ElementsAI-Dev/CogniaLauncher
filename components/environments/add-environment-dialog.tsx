'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { useEnvironments } from '@/lib/hooks/use-environments';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { X, Check, RefreshCw, Globe } from 'lucide-react';

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

export interface AddEnvironmentOptions {
  autoSwitch: boolean;
  setAsDefault: boolean;
}

interface AddEnvironmentDialogProps {
  onAdd?: (language: string, provider: string, version: string, options: AddEnvironmentOptions) => Promise<void>;
}

export function AddEnvironmentDialog({ onAdd }: AddEnvironmentDialogProps) {
  const { t } = useLocale();
  const { addDialogOpen, closeAddDialog, availableProviders } = useEnvironmentStore();
  const { fetchProviders } = useEnvironments();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [versionType, setVersionType] = useState<'lts' | 'latest' | 'specific'>('lts');
  const [specificVersion, setSpecificVersion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Advanced options
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(true);

  // Fetch providers when dialog opens
  useEffect(() => {
    if (addDialogOpen && availableProviders.length === 0) {
      fetchProviders();
    }
  }, [addDialogOpen, availableProviders.length, fetchProviders]);

  // Get providers for selected language - use dynamic providers if available, fallback to static
  const currentProviders = useMemo(() => {
    if (!selectedLanguage) return [];
    
    // First try to get dynamic providers from the store
    const dynamicProviders = availableProviders
      .filter(p => p.env_type.toLowerCase() === selectedLanguage.toLowerCase())
      .map(p => ({ id: p.id, name: p.display_name, description: p.description }));
    
    // If dynamic providers are available, use them; otherwise fallback to static
    if (dynamicProviders.length > 0) {
      return dynamicProviders;
    }
    
    return PROVIDERS[selectedLanguage] || [];
  }, [selectedLanguage, availableProviders]);

  const handleLanguageSelect = (langId: string) => {
    setSelectedLanguage(langId);
    // Reset provider when language changes - will be set after currentProviders updates
    setSelectedProvider('');
  };

  // Auto-select first provider when currentProviders changes
  useEffect(() => {
    if (currentProviders.length > 0 && !selectedProvider) {
      setSelectedProvider(currentProviders[0].id);
    }
  }, [currentProviders, selectedProvider]);

  const handleSubmit = async () => {
    if (!selectedLanguage || !selectedProvider) return;
    
    setIsSubmitting(true);
    try {
      const version = versionType === 'specific' ? specificVersion : versionType;
      await onAdd?.(selectedLanguage, selectedProvider, version, {
        autoSwitch,
        setAsDefault,
      });
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
    setAutoSwitch(true);
    setSetAsDefault(true);
    closeAddDialog();
  };

  // Use dynamic providers (currentProviders) which falls back to static PROVIDERS
  const providers = currentProviders;

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
            <Label id="language-label" className="text-sm font-medium">
              {t('environments.addDialog.selectLanguage')}
            </Label>
            <div 
              role="radiogroup" 
              aria-labelledby="language-label"
              className="grid grid-cols-4 gap-3"
            >
              {LANGUAGES.map((lang, index) => (
                <button
                  key={lang.id}
                  role="radio"
                  aria-checked={selectedLanguage === lang.id}
                  tabIndex={selectedLanguage === lang.id || (selectedLanguage === null && index === 0) ? 0 : -1}
                  onClick={() => handleLanguageSelect(lang.id)}
                  onKeyDown={(e) => {
                    const totalItems = LANGUAGES.length;
                    let nextIndex = index;
                    
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      nextIndex = (index + 1) % totalItems;
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      nextIndex = (index - 1 + totalItems) % totalItems;
                    } else if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLanguageSelect(lang.id);
                      return;
                    } else {
                      return;
                    }
                    
                    handleLanguageSelect(LANGUAGES[nextIndex].id);
                    // Focus the next button
                    const buttons = e.currentTarget.parentElement?.querySelectorAll('[role="radio"]');
                    (buttons?.[nextIndex] as HTMLElement)?.focus();
                  }}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    selectedLanguage === lang.id
                      ? lang.color + ' border-2'
                      : 'border-border bg-background'
                  )}
                >
                  <span className="text-2xl" aria-hidden="true">{lang.icon}</span>
                  <span className="text-sm font-medium">{lang.name}</span>
                  {selectedLanguage === lang.id && (
                    <Check className="h-4 w-4 text-primary absolute top-2 right-2" aria-hidden="true" />
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

          {/* Advanced Options */}
          {selectedLanguage && selectedProvider && (
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium">{t('environments.addDialog.options')}</Label>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('environments.addDialog.autoSwitch')}</p>
                    <p className="text-xs text-muted-foreground">{t('environments.addDialog.autoSwitchDesc')}</p>
                  </div>
                </div>
                <Switch checked={autoSwitch} onCheckedChange={setAutoSwitch} />
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('environments.addDialog.setAsDefault')}</p>
                    <p className="text-xs text-muted-foreground">{t('environments.addDialog.setAsDefaultDesc')}</p>
                  </div>
                </div>
                <Switch checked={setAsDefault} onCheckedChange={setSetAsDefault} />
              </div>
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

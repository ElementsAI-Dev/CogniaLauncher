'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { useSettings } from '@/lib/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { useTheme } from 'next-themes';
import { useAppearanceStore } from '@/lib/stores/appearance';
import { useSettingsShortcuts } from '@/lib/hooks/use-settings-shortcuts';
import {
  validateField,
  GeneralSettings,
  NetworkSettings,
  SecuritySettings,
  MirrorsSettings,
  AppearanceSettings,
  SystemInfo,
  SettingsSkeleton,
} from '@/components/settings';
import { AlertCircle, Save, RotateCcw, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface SaveProgress {
  current: number;
  total: number;
}

export default function SettingsPage() {
  const { config, loading, error, fetchConfig, updateConfigValue, resetConfig, platformInfo, fetchPlatformInfo } = useSettings();
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { reducedMotion, setReducedMotion } = useAppearanceStore();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchConfig(), fetchPlatformInfo()]);
      setInitialLoadComplete(true);
    };
    loadData();
  }, [fetchConfig, fetchPlatformInfo]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const handleChange = useCallback((key: string, value: string) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);

    const validationError = validateField(key, value, t);
    setValidationErrors((prev) => ({ ...prev, [key]: validationError }));
  }, [t]);

  const hasValidationErrors = useCallback(() => {
    return Object.values(validationErrors).some((error) => error !== null);
  }, [validationErrors]);

  const validateAllFields = useCallback(() => {
    const errors: Record<string, string | null> = {};
    let hasErrors = false;

    for (const [key, value] of Object.entries(localConfig)) {
      const error = validateField(key, value, t);
      errors[key] = error;
      if (error) hasErrors = true;
    }

    setValidationErrors(errors);
    return !hasErrors;
  }, [localConfig, t]);

  const handleSave = useCallback(async () => {
    if (!validateAllFields()) {
      toast.error(t('settings.validationError'));
      return;
    }

    const changedKeys = Object.entries(localConfig).filter(
      ([key, value]) => config[key] !== value
    );

    if (changedKeys.length === 0) {
      toast.info(t('settings.noChanges'));
      return;
    }

    setSaving(true);
    setSaveProgress({ current: 0, total: changedKeys.length });

    const errors: string[] = [];

    for (let i = 0; i < changedKeys.length; i++) {
      const [key, value] = changedKeys[i];
      try {
        await updateConfigValue(key, value);
        setSaveProgress({ current: i + 1, total: changedKeys.length });
      } catch (err) {
        errors.push(`${key}: ${err}`);
      }
    }

    setSaving(false);
    setSaveProgress(null);

    if (errors.length === 0) {
      toast.success(t('settings.settingsSaved'));
      setHasChanges(false);
    } else if (errors.length < changedKeys.length) {
      toast.warning(t('settings.partialSaveError', { count: errors.length }));
      setHasChanges(false);
    } else {
      toast.error(t('settings.saveFailed'));
    }
  }, [localConfig, config, updateConfigValue, validateAllFields, t]);

  const handleReset = useCallback(async () => {
    try {
      await resetConfig();
      setValidationErrors({});
      toast.success(t('settings.settingsReset'));
      setHasChanges(false);
    } catch (err) {
      toast.error(`${t('settings.resetFailed')}: ${err}`);
    }
  }, [resetConfig, t]);

  const handleExport = useCallback(() => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: localConfig,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognia-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('settings.exportSuccess'));
  }, [localConfig, t]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.settings || typeof data.settings !== 'object') {
          toast.error(t('settings.importInvalidFormat'));
          return;
        }

        setLocalConfig((prev) => ({ ...prev, ...data.settings }));
        setHasChanges(true);

        const errors: Record<string, string | null> = {};
        for (const [key, value] of Object.entries(data.settings)) {
          if (typeof value === 'string') {
            errors[key] = validateField(key, value, t);
          }
        }
        setValidationErrors((prev) => ({ ...prev, ...errors }));

        toast.success(t('settings.importSuccess'));
      } catch {
        toast.error(t('settings.importFailed'));
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [t]);

  const handleDiscardChanges = useCallback(() => {
    setLocalConfig(config);
    setValidationErrors({});
    setHasChanges(false);
  }, [config]);

  useSettingsShortcuts({
    onSave: handleSave,
    onEscape: hasChanges ? handleDiscardChanges : undefined,
    enabled: true,
    hasChanges,
    isLoading: loading || saving,
  });

  const canSave = hasChanges && !loading && !saving && !hasValidationErrors();

  return (
    <main className="p-4 md:p-6 space-y-6" aria-labelledby="settings-title">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 id="settings-title" className="text-2xl md:text-3xl font-bold">
            {t('settings.title')}
          </h1>
          <p className="text-muted-foreground">{t('settings.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            aria-label={t('settings.importSettings')}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || saving}
          >
            <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('settings.import')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || saving}
          >
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('settings.export')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={loading || saving}>
                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('common.reset')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.resetConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.resetConfirmDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('common.reset')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={!canSave}>
            <Save className="h-4 w-4 mr-2" aria-hidden="true" />
            {saving ? t('settings.saving') : t('settings.saveChanges')}
          </Button>
        </div>
      </header>

      {saveProgress && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span>{t('settings.savingProgress', { current: saveProgress.current, total: saveProgress.total })}</span>
            <span>{Math.round((saveProgress.current / saveProgress.total) * 100)}%</span>
          </div>
          <Progress value={(saveProgress.current / saveProgress.total) * 100} />
        </div>
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasChanges && (
        <Alert role="status">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            {t('settings.unsavedChanges')}
            <span className="text-muted-foreground ml-2">
              ({t('settings.shortcutHint')})
            </span>
          </AlertDescription>
        </Alert>
      )}

      {!initialLoadComplete ? (
        <SettingsSkeleton />
      ) : (
        <>
          <GeneralSettings
            localConfig={localConfig}
            errors={validationErrors}
            onValueChange={handleChange}
            t={t}
          />

          <NetworkSettings
            localConfig={localConfig}
            errors={validationErrors}
            onValueChange={handleChange}
            t={t}
          />

          <SecuritySettings
            localConfig={localConfig}
            onValueChange={handleChange}
            t={t}
          />

          <MirrorsSettings
            localConfig={localConfig}
            errors={validationErrors}
            onValueChange={handleChange}
            t={t}
          />

          <AppearanceSettings
            theme={theme}
            setTheme={setTheme}
            locale={locale}
            setLocale={setLocale}
            reducedMotion={reducedMotion}
            setReducedMotion={setReducedMotion}
            t={t}
          />

          <SystemInfo
            loading={loading}
            platformInfo={platformInfo}
            t={t}
          />
        </>
      )}
    </main>
  );
}

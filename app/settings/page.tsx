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
import { useSettings } from '@/hooks/use-settings';
import { useLocale } from '@/components/providers/locale-provider';
import { useTheme } from 'next-themes';
import { useAppearanceStore, type AccentColor } from '@/lib/stores/appearance';
import { useSettingsStore } from '@/lib/stores/settings';
import { isTauri } from '@/lib/tauri';
import { isThemeMode } from '@/lib/theme';
import { useSettingsShortcuts, useSectionNavigation } from '@/hooks/use-settings-shortcuts';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useSettingsSearch, useActiveSection } from '@/hooks/use-settings-search';
import {
  validateField,
  GeneralSettings,
  NetworkSettings,
  SecuritySettings,
  MirrorsSettings,
  AppearanceSettings,
  UpdateSettings,
  TraySettings,
  PathsSettings,
  ProviderSettings,
  SystemInfo,
  SettingsSkeleton,
} from '@/components/settings';
import { SettingsSearch } from '@/components/settings/settings-search';
import { SettingsNav } from '@/components/settings/settings-nav';
import { CollapsibleSection } from '@/components/settings/collapsible-section';
import { PageHeader } from '@/components/layout/page-header';
import { AlertCircle, Save, RotateCcw, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { type SettingsSection } from '@/lib/constants/settings-registry';

interface SaveProgress {
  current: number;
  total: number;
}

// Section IDs in order
const SECTION_IDS: SettingsSection[] = [
  'general',
  'network',
  'security',
  'mirrors',
  'appearance',
  'updates',
  'tray',
  'paths',
  'provider',
  'system',
];

export default function SettingsPage() {
  const { config, loading, error, fetchConfig, updateConfigValue, resetConfig, platformInfo, fetchPlatformInfo } = useSettings();
  const { appSettings, setAppSettings } = useSettingsStore();
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor, reducedMotion, setReducedMotion } = useAppearanceStore();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [originalConfig, setOriginalConfig] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<SettingsSection>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search functionality
  const search = useSettingsSearch({ t, showAdvanced: true, showTauriOnly: isTauri() });

  // Section navigation
  const { activeSection, setActiveSection, scrollToSection } = useActiveSection(SECTION_IDS);
  const { navigateSection, jumpToSection } = useSectionNavigation({
    sectionIds: SECTION_IDS,
    activeSection,
    setActiveSection,
  });

  // Track which sections have changes
  const sectionHasChanges = useCallback(
    (sectionId: SettingsSection): boolean => {
      const sectionPrefixes: Record<SettingsSection, string[]> = {
        general: ['general.'],
        network: ['network.'],
        security: ['security.'],
        mirrors: ['mirrors.'],
        appearance: ['appearance.'],
        updates: ['updates.'],
        tray: ['tray.'],
        paths: ['paths.'],
        provider: ['provider_settings.'],
        system: [],
      };
      const prefixes = sectionPrefixes[sectionId] || [];
      return Object.entries(localConfig).some(([key, value]) =>
        prefixes.some((prefix) => key.startsWith(prefix) && originalConfig[key] !== value)
      );
    },
    [localConfig, originalConfig]
  );

  useUnsavedChanges('settings-page', hasChanges);

  useEffect(() => {
    const loadData = async () => {
      const shouldFetchConfig = Object.keys(config).length === 0;
      await Promise.all([
        shouldFetchConfig ? fetchConfig() : Promise.resolve(config),
        fetchPlatformInfo(),
      ]);
      setInitialLoadComplete(true);
    };
    loadData();
  }, [config, fetchConfig, fetchPlatformInfo]);

  useEffect(() => {
    setLocalConfig(config);
    setOriginalConfig(config);
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
      appSettings,
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
  }, [localConfig, appSettings, t]);

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

        if (data.appSettings && typeof data.appSettings === 'object') {
          setAppSettings(data.appSettings);
        }

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
  }, [setAppSettings, t]);

  const handleDiscardChanges = useCallback(() => {
    setLocalConfig(config);
    setValidationErrors({});
    setHasChanges(false);
  }, [config]);

  // Appearance settings handlers with backend sync
  const handleThemeChange = useCallback(async (newTheme: string) => {
    if (!isThemeMode(newTheme)) {
      toast.error(t('settings.invalidTheme'));
      return;
    }

    setTheme(newTheme);
    if (isTauri()) {
      try {
        await updateConfigValue('appearance.theme', newTheme);
      } catch (err) {
        console.error('Failed to sync theme to backend:', err);
      }
    }
  }, [setTheme, updateConfigValue, t]);

  const handleLocaleChange = useCallback(async (newLocale: 'en' | 'zh') => {
    setLocale(newLocale);
    if (isTauri()) {
      try {
        await updateConfigValue('appearance.language', newLocale);
      } catch (err) {
        console.error('Failed to sync language to backend:', err);
      }
    }
  }, [setLocale, updateConfigValue]);

  const handleAccentColorChange = useCallback(async (color: AccentColor) => {
    setAccentColor(color);
    if (isTauri()) {
      try {
        await updateConfigValue('appearance.accent_color', color);
      } catch (err) {
        console.error('Failed to sync accent color to backend:', err);
      }
    }
  }, [setAccentColor, updateConfigValue]);

  const handleReducedMotionChange = useCallback(async (reduced: boolean) => {
    setReducedMotion(reduced);
    if (isTauri()) {
      try {
        await updateConfigValue('appearance.reduced_motion', String(reduced));
      } catch (err) {
        console.error('Failed to sync reduced motion to backend:', err);
      }
    }
  }, [setReducedMotion, updateConfigValue]);

  // Focus search handler
  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  // Section collapse handler
  const handleSectionOpenChange = useCallback((sectionId: SettingsSection, open: boolean) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (open) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Reset a single section to defaults
  const handleResetSection = useCallback(
    async (sectionId: SettingsSection) => {
      const sectionPrefixes: Record<SettingsSection, string[]> = {
        general: ['general.'],
        network: ['network.'],
        security: ['security.'],
        mirrors: ['mirrors.'],
        appearance: ['appearance.'],
        updates: ['updates.'],
        tray: ['tray.'],
        paths: ['paths.'],
        provider: ['provider_settings.'],
        system: [],
      };
      const prefixes = sectionPrefixes[sectionId] || [];
      
      // Reset local config for this section to original values
      setLocalConfig((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (prefixes.some((prefix) => key.startsWith(prefix))) {
            next[key] = originalConfig[key] ?? '';
          }
        }
        return next;
      });

      // Clear validation errors for this section
      setValidationErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (prefixes.some((prefix) => key.startsWith(prefix))) {
            next[key] = null;
          }
        }
        return next;
      });

      toast.success(t('settings.sectionReset', { section: t(`settings.sections.${sectionId}`) }));
    },
    [originalConfig, t]
  );

  // Navigate to setting from search
  const handleNavigateToSetting = useCallback(
    (section: SettingsSection, key: string) => {
      // Expand the section if collapsed
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
      
      // Scroll to section
      scrollToSection(section);
      
      // Clear search
      search.clearSearch();
      
      // Focus the setting input after a short delay
      setTimeout(() => {
        const element = document.getElementById(key);
        if (element) {
          element.focus();
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    },
    [scrollToSection, search]
  );

  useSettingsShortcuts({
    onSave: handleSave,
    onReset: handleReset,
    onEscape: hasChanges ? handleDiscardChanges : search.isSearching ? search.clearSearch : undefined,
    onFocusSearch: handleFocusSearch,
    onNavigateSection: navigateSection,
    onJumpToSection: jumpToSection,
    enabled: true,
    hasChanges,
    isLoading: loading || saving,
  });

  const handleAppSettingsChange = useCallback(<K extends keyof typeof appSettings>(key: K, value: typeof appSettings[K]) => {
    setAppSettings({ [key]: value });
  }, [setAppSettings]);

  const canSave = hasChanges && !loading && !saving && !hasValidationErrors();
  const canReset = !loading && !saving;

  return (
    <main className="p-4 md:p-6 space-y-6" aria-labelledby="settings-title">
      <PageHeader
        title={<span id="settings-title">{t('settings.title')}</span>}
        description={t('settings.description')}
        actions={(
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              aria-label={t('settings.importSettings')}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('settings.import')}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('settings.export')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={!canReset}>
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t('common.reset')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.resetConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('settings.resetConfirmDesc')}</AlertDialogDescription>
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
          </>
        )}
      />

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
        <div className="flex gap-6">
          {/* Sidebar Navigation - Hidden on mobile */}
          <aside className="hidden lg:block w-56 shrink-0">
            <SettingsNav
              activeSection={activeSection}
              onSectionClick={scrollToSection}
              matchingSections={search.matchingSections}
              isSearching={search.isSearching}
              collapsedSections={collapsedSections}
              sectionHasChanges={sectionHasChanges}
              t={t}
            />
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* Search Bar */}
            <SettingsSearch
              search={search}
              onNavigateToSetting={handleNavigateToSetting}
              t={t}
            />

            {/* Settings Sections */}
            <CollapsibleSection
              id="general"
              title={t('settings.general')}
              description={t('settings.generalDesc')}
              icon="Settings2"
              defaultOpen={!collapsedSections.has('general')}
              hasChanges={sectionHasChanges('general')}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <GeneralSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="network"
              title={t('settings.network')}
              description={t('settings.networkDesc')}
              icon="Network"
              defaultOpen={!collapsedSections.has('network')}
              hasChanges={sectionHasChanges('network')}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <NetworkSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="security"
              title={t('settings.security')}
              description={t('settings.securityDesc')}
              icon="Shield"
              defaultOpen={!collapsedSections.has('security')}
              hasChanges={sectionHasChanges('security')}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <SecuritySettings
                localConfig={localConfig}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="mirrors"
              title={t('settings.mirrors')}
              description={t('settings.mirrorsDesc')}
              icon="Server"
              defaultOpen={!collapsedSections.has('mirrors')}
              hasChanges={sectionHasChanges('mirrors')}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <MirrorsSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="appearance"
              title={t('settings.appearance')}
              description={t('settings.appearanceDesc')}
              icon="Palette"
              defaultOpen={!collapsedSections.has('appearance')}
              hasChanges={sectionHasChanges('appearance')}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <AppearanceSettings
                theme={theme}
                setTheme={handleThemeChange}
                locale={locale}
                setLocale={handleLocaleChange}
                accentColor={accentColor}
                setAccentColor={handleAccentColorChange}
                reducedMotion={reducedMotion}
                setReducedMotion={handleReducedMotionChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="updates"
              title={t('settings.updates')}
              description={t('settings.updatesDesc')}
              icon="RefreshCw"
              defaultOpen={!collapsedSections.has('updates')}
              hasChanges={sectionHasChanges('updates')}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <UpdateSettings
                appSettings={appSettings}
                onValueChange={handleAppSettingsChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="tray"
              title={t('settings.tray')}
              description={t('settings.trayDesc')}
              icon="Monitor"
              defaultOpen={!collapsedSections.has('tray')}
              hasChanges={sectionHasChanges('tray')}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <TraySettings
                appSettings={appSettings}
                onValueChange={handleAppSettingsChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="paths"
              title={t('settings.paths')}
              description={t('settings.pathsDesc')}
              icon="FolderOpen"
              defaultOpen={!collapsedSections.has('paths')}
              hasChanges={sectionHasChanges('paths')}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <PathsSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="provider"
              title={t('settings.providerSettings')}
              description={t('settings.providerSettingsDesc')}
              icon="Package"
              defaultOpen={!collapsedSections.has('provider')}
              hasChanges={sectionHasChanges('provider')}
              onResetSection={handleResetSection}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <ProviderSettings
                localConfig={localConfig}
                errors={validationErrors}
                onValueChange={handleChange}
                t={t}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="system"
              title={t('settings.systemInfo')}
              description={t('settings.systemInfoDesc')}
              icon="Info"
              defaultOpen={!collapsedSections.has('system')}
              hasChanges={false}
              onOpenChange={handleSectionOpenChange}
              t={t}
            >
              <SystemInfo
                loading={loading}
                platformInfo={platformInfo}
                t={t}
              />
            </CollapsibleSection>
          </div>
        </div>
      )}
    </main>
  );
}

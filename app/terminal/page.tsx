'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { useTerminal } from '@/hooks/use-terminal';
import { useLocale } from '@/components/providers/locale-provider';
import {
  TerminalDetectedShells,
  TerminalProfileList,
  TerminalProfileDialog,
  TerminalShellConfig,
  TerminalShellFramework,
  TerminalPsManagement,
  TerminalPsModulesTable,
  TerminalProxySettings,
  TerminalEnvVars,
  TerminalTemplatePicker,
} from '@/components/terminal';
import type { TerminalProfile, TerminalProfileTemplate } from '@/types/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Monitor, User, FileText, Blocks, Shield, Globe, Variable, RefreshCw, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type PendingNavigationIntent =
  | { kind: 'tab'; nextTab: string }
  | { kind: 'config-target' };

interface ConfigRefreshIntent {
  signal: number;
  configEntries: boolean;
  configMetadata: boolean;
}

export default function TerminalPage() {
  const { t } = useLocale();
  const terminal = useTerminal({ t });
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(null);
  const [templateProfile, setTemplateProfile] = useState<TerminalProfile | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [saveAsTemplateProfileId, setSaveAsTemplateProfileId] = useState<string | null>(null);
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('');
  const [saveAsTemplateDesc, setSaveAsTemplateDesc] = useState('');
  const [activeTab, setActiveTab] = useState('shells');

  const getTabDescription = (tab: string): string => {
    switch (tab) {
      case 'shells': return t('terminal.tabDescShells');
      case 'profiles': return t('terminal.tabDescProfiles');
      case 'config': return t('terminal.tabDescConfig');
      case 'frameworks': return t('terminal.tabDescFrameworks');
      case 'powershell': return t('terminal.tabDescPowerShell');
      case 'proxy': return t('terminal.tabDescProxy');
      case 'envvars': return t('terminal.tabDescEnvVars');
      default: return '';
    }
  };
  const [pendingNavigationIntent, setPendingNavigationIntent] = useState<PendingNavigationIntent | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [discardSignal, setDiscardSignal] = useState(0);
  const [configRefreshIntent, setConfigRefreshIntent] = useState<ConfigRefreshIntent>({
    signal: 0,
    configEntries: false,
    configMetadata: false,
  });

  const profileDialogKey = `${profileDialogOpen ? 'open' : 'closed'}:${editingProfile?.id ?? 'new'}:${templateProfile?.name ?? 'none'}:${terminal.shells
    .map((shell) => shell.id)
    .join('|')}`;

  const handleCreateNew = useCallback(() => {
    setEditingProfile(null);
    setTemplateProfile(null);
    setProfileDialogOpen(true);
  }, []);

  const handleEdit = useCallback((profile: TerminalProfile) => {
    setEditingProfile(profile);
    setTemplateProfile(null);
    setProfileDialogOpen(true);
  }, []);

  const handleFromTemplate = useCallback(() => {
    setTemplatePickerOpen(true);
  }, []);

  const handleTemplateSelect = useCallback(async (tpl: TerminalProfileTemplate) => {
    const prefilled = await terminal.createProfileFromTemplate(tpl.id);
    if (prefilled) {
      setEditingProfile(null);
      setTemplateProfile(prefilled);
      setProfileDialogOpen(true);
    }
  }, [terminal]);

  const handleSaveAsTemplate = useCallback((profileId: string) => {
    const profile = terminal.profiles.find((p) => p.id === profileId);
    setSaveAsTemplateProfileId(profileId);
    setSaveAsTemplateName(profile?.name ?? '');
    setSaveAsTemplateDesc('');
    setSaveAsTemplateOpen(true);
  }, [terminal.profiles]);

  const handleConfirmSaveAsTemplate = useCallback(async () => {
    if (!saveAsTemplateProfileId || !saveAsTemplateName.trim()) return;
    await terminal.saveProfileAsTemplate(
      saveAsTemplateProfileId,
      saveAsTemplateName.trim(),
      saveAsTemplateDesc.trim(),
    );
    setSaveAsTemplateOpen(false);
  }, [saveAsTemplateProfileId, saveAsTemplateName, saveAsTemplateDesc, terminal]);

  const fetchStaleTabResources = useCallback((tab: string) => {
    switch (tab) {
      case 'powershell':
        if (terminal.resourceStale.psProfiles) terminal.fetchPSProfiles();
        if (terminal.resourceStale.psModules) terminal.fetchPSModules();
        if (terminal.resourceStale.psScripts) terminal.fetchPSScripts();
        if (terminal.resourceStale.executionPolicy) terminal.fetchExecutionPolicy();
        break;
      case 'proxy':
        if (terminal.resourceStale.proxyConfig) {
          terminal.loadProxyConfig();
        } else if (terminal.resourceStale.proxyEnvVars) {
          terminal.fetchProxyEnvVars();
        }
        break;
      case 'envvars':
        if (terminal.resourceStale.shellEnvVars) terminal.fetchShellEnvVars();
        break;
      default:
        break;
    }
  }, [terminal]);

  const activateTab = useCallback((tab: string) => {
    setActiveTab(tab);
    fetchStaleTabResources(tab);
  }, [fetchStaleTabResources]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === activeTab) return;
    if (configDirty) {
      setPendingNavigationIntent({ kind: 'tab', nextTab: tab });
      return;
    }
    activateTab(tab);
  }, [activeTab, activateTab, configDirty]);

  const handleSaveProfile = useCallback(async (profile: TerminalProfile) => {
    if (profile.id) {
      await terminal.updateProfile(profile);
    } else {
      await terminal.createProfile(profile);
    }
  }, [terminal]);

  const handleConfigDiscardRequest = useCallback(() => {
    setPendingNavigationIntent({ kind: 'config-target' });
  }, []);

  const handleConfirmDiscard = useCallback(() => {
    const currentIntent = pendingNavigationIntent;
    setDiscardSignal((prev) => prev + 1);
    setConfigDirty(false);
    setPendingNavigationIntent(null);
    if (currentIntent?.kind === 'tab') {
      activateTab(currentIntent.nextTab);
    }
  }, [activateTab, pendingNavigationIntent]);

  useEffect(() => {
    if (activeTab !== 'config') return;
    if (terminal.resourceStale.configEntries || terminal.resourceStale.configMetadata) {
      setConfigRefreshIntent((prev) => ({
        signal: prev.signal + 1,
        configEntries: terminal.resourceStale.configEntries,
        configMetadata: terminal.resourceStale.configMetadata,
      }));
    }
  }, [activeTab, terminal.resourceStale.configEntries, terminal.resourceStale.configMetadata]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
      <PageHeader
        title={t('terminal.title')}
        description={t('terminal.description')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { terminal.detectShells(); terminal.fetchProfiles(); }}
              disabled={terminal.loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${terminal.loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={handleCreateNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('terminal.createProfile')}
            </Button>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">{getTabDescription(activeTab)}</p>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="shells" className="flex-none gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            {t('terminal.tabShells')}
            {terminal.shells.length > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">{terminal.shells.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="profiles" className="flex-none gap-1.5">
            <User className="h-3.5 w-3.5" />
            {t('terminal.tabProfiles')}
            {terminal.profiles.length > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">{terminal.profiles.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="config" className="flex-none gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {t('terminal.tabConfig')}
          </TabsTrigger>
          <TabsTrigger value="frameworks" className="flex-none gap-1.5">
            <Blocks className="h-3.5 w-3.5" />
            {t('terminal.tabFrameworks')}
            {terminal.frameworks.length > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">{terminal.frameworks.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="powershell" className="flex-none gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            {t('terminal.tabPowerShell')}
          </TabsTrigger>
          <TabsTrigger value="proxy" className="flex-none gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t('terminal.tabProxy')}
          </TabsTrigger>
          <TabsTrigger value="envvars" className="flex-none gap-1.5">
            <Variable className="h-3.5 w-3.5" />
            {t('terminal.tabEnvVars')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shells">
          <TerminalDetectedShells
            shells={terminal.shells}
            loading={terminal.shellsLoading}
            startupMeasurements={terminal.startupMeasurements}
            measuringShellId={terminal.measuringShellId}
            onMeasureStartup={terminal.measureStartup}
            healthResults={terminal.healthResults}
            checkingHealthShellId={terminal.checkingHealthShellId}
            onCheckShellHealth={terminal.checkShellHealth}
          />
        </TabsContent>

        <TabsContent value="profiles">
          <TerminalProfileList
            profiles={terminal.profiles}
            onLaunch={terminal.launchProfile}
            onEdit={handleEdit}
            onDelete={terminal.deleteProfile}
            onSetDefault={terminal.setDefaultProfile}
            onCreateNew={handleCreateNew}
            onDuplicate={terminal.duplicateProfile}
            onExportAll={async () => {
              const json = await terminal.exportProfiles();
              if (json) {
                try {
                  const dialogModule = await import('@tauri-apps/plugin-dialog');
                  const fsModule = await import('@tauri-apps/plugin-fs');
                  const path = await dialogModule.save({
                    defaultPath: 'terminal-profiles.json',
                    filters: [{ name: 'JSON', extensions: ['json'] }],
                  });
                  if (path) {
                    await fsModule.writeTextFile(path, json);
                  }
                } catch {
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'terminal-profiles.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }
            }}
            onImport={terminal.importProfiles}
            onFromTemplate={handleFromTemplate}
            onSaveAsTemplate={handleSaveAsTemplate}
            launchingProfileId={terminal.launchingProfileId}
            lastLaunchResult={terminal.lastLaunchResult}
            onClearLaunchResult={terminal.clearLaunchResult}
          />
        </TabsContent>

        <TabsContent value="config">
          <TerminalShellConfig
            shells={terminal.shells}
            onReadConfig={terminal.readShellConfig}
            onFetchConfigEntries={terminal.fetchConfigEntries}
            onParseConfigContent={terminal.parseConfigContent}
            onValidateConfigContent={terminal.validateConfigContent}
            onBackupConfig={terminal.backupShellConfig}
            onWriteConfig={terminal.writeShellConfig}
            onGetConfigEditorMetadata={terminal.getConfigEditorMetadata}
            onRestoreConfigSnapshot={terminal.restoreConfigSnapshot}
            mutationStatus={terminal.configMutationState.status}
            mutationMessage={terminal.configMutationState.message}
            mutationResult={terminal.configMutationState.result}
            onClearMutationState={terminal.clearConfigMutationState}
            onDirtyChange={setConfigDirty}
            onRequestDiscard={handleConfigDiscardRequest}
            discardSignal={discardSignal}
            refreshIntent={configRefreshIntent}
            onRefreshHandled={(handled) => {
              const resources: Array<'configEntries' | 'configMetadata'> = [];
              if (handled.configEntries) resources.push('configEntries');
              if (handled.configMetadata) resources.push('configMetadata');
              if (resources.length === 0) return;
              terminal.markResourcesFresh(resources);
            }}
          />
        </TabsContent>

        <TabsContent value="frameworks">
          <TerminalShellFramework
            shells={terminal.shells}
            frameworks={terminal.frameworks}
            plugins={terminal.plugins}
            frameworkCacheStats={terminal.frameworkCacheStats}
            frameworkCacheLoading={terminal.frameworkCacheLoading}
            onDetectFrameworks={terminal.detectFrameworks}
            onFetchPlugins={terminal.fetchPlugins}
            onFetchCacheStats={terminal.fetchFrameworkCacheStats}
            onCleanFrameworkCache={terminal.cleanFrameworkCache}
            loading={terminal.loading}
          />
        </TabsContent>

        <TabsContent value="powershell" className="space-y-4">
          <TerminalPsManagement
            psProfiles={terminal.psProfiles}
            executionPolicy={terminal.executionPolicy}
            onFetchPSProfiles={terminal.fetchPSProfiles}
            onReadPSProfile={terminal.readPSProfile}
            onWritePSProfile={terminal.writePSProfile}
            onFetchExecutionPolicy={terminal.fetchExecutionPolicy}
            onSetExecutionPolicy={terminal.setExecutionPolicy}
            loading={terminal.loading}
          />
          <TerminalPsModulesTable
            modules={terminal.psModules}
            scripts={terminal.psScripts}
            onFetchModules={terminal.fetchPSModules}
            onFetchScripts={terminal.fetchPSScripts}
            onInstallModule={terminal.installPSModule}
            onUninstallModule={terminal.uninstallPSModule}
            onUpdateModule={terminal.updatePSModule}
            loading={terminal.loading}
          />
        </TabsContent>

        <TabsContent value="proxy">
          <TerminalProxySettings
            proxyEnvVars={terminal.proxyEnvVars}
            proxyMode={terminal.proxyMode}
            globalProxy={terminal.globalProxy}
            customProxy={terminal.customProxy}
            noProxy={terminal.noProxy}
            saving={terminal.proxyConfigSaving}
            syncStatus={terminal.proxySyncState.status}
            syncMessage={terminal.proxySyncState.message}
            onProxyModeChange={terminal.updateProxyMode}
            onCustomProxyChange={terminal.updateCustomProxy}
            onCustomProxyBlur={terminal.saveCustomProxy}
            onNoProxyChange={terminal.updateNoProxy}
            onNoProxyBlur={terminal.saveNoProxy}
            onRetrySync={() => {
              terminal.loadProxyConfig();
            }}
            onClearSyncState={terminal.clearProxySyncState}
            loading={terminal.loading}
          />
        </TabsContent>

        <TabsContent value="envvars">
          <TerminalEnvVars
            shellEnvVars={terminal.shellEnvVars}
            onFetchShellEnvVars={terminal.fetchShellEnvVars}
            loading={terminal.loading}
          />
        </TabsContent>
      </Tabs>

      <TerminalProfileDialog
        key={profileDialogKey}
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        profile={editingProfile}
        shells={terminal.shells}
        onSave={handleSaveProfile}
        fromTemplate={templateProfile}
      />

      <TerminalTemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        templates={terminal.templates}
        onSelect={handleTemplateSelect}
        onDelete={terminal.deleteCustomTemplate}
      />

      <Dialog open={saveAsTemplateOpen} onOpenChange={setSaveAsTemplateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('terminal.saveAsTemplate')}</DialogTitle>
            <DialogDescription>{t('terminal.saveAsTemplateDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tpl-name">{t('terminal.templateName')}</Label>
              <Input
                id="tpl-name"
                value={saveAsTemplateName}
                onChange={(e) => setSaveAsTemplateName(e.target.value)}
                placeholder="My Template"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tpl-desc">{t('terminal.templateDescription')}</Label>
              <Input
                id="tpl-desc"
                value={saveAsTemplateDesc}
                onChange={(e) => setSaveAsTemplateDesc(e.target.value)}
                placeholder="A useful terminal setup..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsTemplateOpen(false)}>
              {t('terminal.cancel')}
            </Button>
            <Button onClick={handleConfirmSaveAsTemplate} disabled={!saveAsTemplateName.trim()}>
              {t('terminal.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingNavigationIntent !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigationIntent(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('terminal.unsavedChangesTitle')}</DialogTitle>
            <DialogDescription>{t('terminal.unsavedChangesDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingNavigationIntent(null)}>
              {t('terminal.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDiscard}>
              {t('terminal.discardAndContinue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

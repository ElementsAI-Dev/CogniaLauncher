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

export default function TerminalPage() {
  const { t } = useLocale();
  const terminal = useTerminal();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(null);
  const [templateProfile, setTemplateProfile] = useState<TerminalProfile | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [saveAsTemplateProfileId, setSaveAsTemplateProfileId] = useState<string | null>(null);
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('');
  const [saveAsTemplateDesc, setSaveAsTemplateDesc] = useState('');

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

  useEffect(() => {
    terminal.loadProxyConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminal.loadProxyConfig]);

  const handleSaveProfile = useCallback(async (profile: TerminalProfile) => {
    if (profile.id) {
      await terminal.updateProfile(profile);
    } else {
      await terminal.createProfile(profile);
    }
  }, [terminal]);

  return (
    <div className="p-4 md:p-6 space-y-6">
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

      <Tabs defaultValue="shells" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shells" className="gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            {t('terminal.tabShells')}
          </TabsTrigger>
          <TabsTrigger value="profiles" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            {t('terminal.tabProfiles')}
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {t('terminal.tabConfig')}
          </TabsTrigger>
          <TabsTrigger value="frameworks" className="gap-1.5">
            <Blocks className="h-3.5 w-3.5" />
            {t('terminal.tabFrameworks')}
          </TabsTrigger>
          <TabsTrigger value="powershell" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            {t('terminal.tabPowerShell')}
          </TabsTrigger>
          <TabsTrigger value="proxy" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t('terminal.tabProxy')}
          </TabsTrigger>
          <TabsTrigger value="envvars" className="gap-1.5">
            <Variable className="h-3.5 w-3.5" />
            {t('terminal.tabEnvVars')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shells">
          <TerminalDetectedShells
            shells={terminal.shells}
            loading={terminal.loading}
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
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'terminal-profiles.json';
                a.click();
                URL.revokeObjectURL(url);
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
            onBackupConfig={terminal.backupShellConfig}
            onWriteConfig={terminal.writeShellConfig}
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
            onProxyModeChange={terminal.updateProxyMode}
            onCustomProxyChange={terminal.updateCustomProxy}
            onCustomProxyBlur={terminal.saveCustomProxy}
            onNoProxyChange={terminal.updateNoProxy}
            onNoProxyBlur={terminal.saveNoProxy}
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
    </div>
  );
}

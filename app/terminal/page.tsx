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
} from '@/components/terminal';
import type { TerminalProfile } from '@/types/tauri';
import { Monitor, User, FileText, Blocks, Shield, Globe, Variable } from 'lucide-react';

export default function TerminalPage() {
  const { t } = useLocale();
  const terminal = useTerminal();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(null);
  const profileDialogKey = `${profileDialogOpen ? 'open' : 'closed'}:${editingProfile?.id ?? 'new'}:${terminal.shells
    .map((shell) => shell.id)
    .join('|')}`;

  const handleCreateNew = useCallback(() => {
    setEditingProfile(null);
    setProfileDialogOpen(true);
  }, []);

  const handleEdit = useCallback((profile: TerminalProfile) => {
    setEditingProfile(profile);
    setProfileDialogOpen(true);
  }, []);

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
    <main className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('terminal.title')}
        description={t('terminal.description')}
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
            onBackupConfig={terminal.backupShellConfig}
            onWriteConfig={terminal.writeShellConfig}
          />
        </TabsContent>

        <TabsContent value="frameworks">
          <TerminalShellFramework
            shells={terminal.shells}
            frameworks={terminal.frameworks}
            plugins={terminal.plugins}
            onDetectFrameworks={terminal.detectFrameworks}
            onFetchPlugins={terminal.fetchPlugins}
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
      />
    </main>
  );
}

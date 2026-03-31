'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useTerminal } from '@/hooks/terminal/use-terminal';
import { useLocale } from '@/components/providers/locale-provider';
import {
  TerminalProfileDialog,
  TerminalTemplatePicker,
} from '@/components/terminal';
import { TerminalNav, TERMINAL_SECTIONS, type TerminalSection, type TerminalSectionDef } from '@/components/terminal/terminal-nav';
import { TerminalQuickStatus } from '@/components/terminal/terminal-quick-status';
import { ShellEnvironmentSection } from '@/components/terminal/sections/shell-environment-section';
import { ProfilesSection } from '@/components/terminal/sections/profiles-section';
import { ConfigurationSection } from '@/components/terminal/sections/configuration-section';
import { NetworkSection } from '@/components/terminal/sections/network-section';
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

type PendingNavigationIntent =
  | { kind: 'section'; nextSection: TerminalSection }
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
  const [activeSection, setActiveSection] = useState<TerminalSection>('shell-environment');

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

  // Section definitions with dynamic labels and badges
  const sections: TerminalSectionDef[] = useMemo(() =>
    TERMINAL_SECTIONS.map((s) => ({
      ...s,
      label: t(`terminal.section.${s.id}`),
      badge: s.id === 'shell-environment' ? terminal.shells.length
        : s.id === 'profiles' ? terminal.profiles.length
        : undefined,
    })),
  [t, terminal.shells.length, terminal.profiles.length]);

  // Health status for quick status widget
  const healthStatus = useMemo(() => {
    const results = Object.values(terminal.healthResults);
    if (results.length === 0) return 'unchecked' as const;
    if (results.some((r) => r.status === 'error')) return 'error' as const;
    if (results.some((r) => r.status === 'warning')) return 'warning' as const;
    return 'ok' as const;
  }, [terminal.healthResults]);

  // Profile callbacks
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

  const handleExportAll = useCallback(async () => {
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
  }, [terminal]);

  // Stale resource fetching on section change
  const fetchStaleResources = useCallback((section: TerminalSection) => {
    switch (section) {
      case 'shell-environment':
        if (terminal.resourceStale.shellEnvVars) terminal.fetchShellEnvVars();
        break;
      case 'configuration':
        if (terminal.resourceStale.psProfiles) terminal.fetchPSProfiles();
        if (terminal.resourceStale.psModules) terminal.fetchPSModules();
        if (terminal.resourceStale.psScripts) terminal.fetchPSScripts();
        if (terminal.resourceStale.executionPolicy) terminal.fetchExecutionPolicy();
        break;
      case 'network':
        if (terminal.resourceStale.proxyConfig) {
          terminal.loadProxyConfig();
        } else if (terminal.resourceStale.proxyEnvVars) {
          terminal.fetchProxyEnvVars();
        }
        break;
      default:
        break;
    }
  }, [terminal]);

  const activateSection = useCallback((section: TerminalSection) => {
    setActiveSection(section);
    fetchStaleResources(section);
  }, [fetchStaleResources]);

  const handleSectionClick = useCallback((section: TerminalSection) => {
    if (section === activeSection) return;
    if (configDirty && activeSection === 'configuration') {
      setPendingNavigationIntent({ kind: 'section', nextSection: section });
      return;
    }
    activateSection(section);
  }, [activeSection, activateSection, configDirty]);

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
    if (currentIntent?.kind === 'section') {
      activateSection(currentIntent.nextSection);
    }
  }, [activateSection, pendingNavigationIntent]);

  useEffect(() => {
    if (activeSection !== 'configuration') return;
    if (terminal.resourceStale.configEntries || terminal.resourceStale.configMetadata) {
      setConfigRefreshIntent((prev) => ({
        signal: prev.signal + 1,
        configEntries: terminal.resourceStale.configEntries,
        configMetadata: terminal.resourceStale.configMetadata,
      }));
    }
  }, [activeSection, terminal.resourceStale.configEntries, terminal.resourceStale.configMetadata]);

  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
      <PageHeader
        title={t('terminal.title')}
        description={t('terminal.description')}
      />

      <div className="mt-6 flex gap-6">
        {/* Sidebar */}
        <TerminalNav
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          sections={sections}
          className="sticky top-20 hidden h-[calc(100vh-8rem)] md:flex"
        >
          <TerminalQuickStatus
            shellCount={terminal.shells.length}
            profileCount={terminal.profiles.length}
            healthStatus={healthStatus}
            proxyMode={terminal.proxyMode}
            t={t}
            className="m-2 mt-auto"
          />
        </TerminalNav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === 'shell-environment' && (
            <ShellEnvironmentSection terminal={terminal} t={t} />
          )}
          {activeSection === 'profiles' && (
            <ProfilesSection
              terminal={terminal}
              onEdit={handleEdit}
              onCreateNew={handleCreateNew}
              onFromTemplate={handleFromTemplate}
              onSaveAsTemplate={handleSaveAsTemplate}
              onExportAll={handleExportAll}
              t={t}
            />
          )}
          {activeSection === 'configuration' && (
            <ConfigurationSection
              terminal={terminal}
              configDirty={configDirty}
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
              t={t}
            />
          )}
          {activeSection === 'network' && (
            <NetworkSection terminal={terminal} t={t} />
          )}
        </div>
      </div>

      {/* Dialogs */}
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
        onCreateCustom={terminal.createCustomTemplate}
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

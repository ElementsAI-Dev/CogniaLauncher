'use client';

import { TerminalProfileList } from '@/components/terminal/terminal-profile-list';
import type { TerminalProfile } from '@/types/tauri';

interface ProfilesSectionProps {
  terminal: {
    profiles: TerminalProfile[];
    launchProfile: (id: string) => void;
    deleteProfile: (id: string) => void;
    setDefaultProfile: (id: string) => void;
    duplicateProfile: (id: string) => void;
    exportProfiles: () => Promise<string | null>;
    importProfiles: (json: string, merge: boolean) => Promise<number | void>;
    launchingProfileId: string | null;
    lastLaunchResult: { profileId: string; result: { success: boolean; exitCode: number; stdout: string; stderr: string } } | null;
    clearLaunchResult: () => void;
  };
  onEdit: (profile: TerminalProfile) => void;
  onCreateNew: () => void;
  onFromTemplate: () => void;
  onSaveAsTemplate: (profileId: string) => void;
  onExportAll: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ProfilesSection({
  terminal,
  onEdit,
  onCreateNew,
  onFromTemplate,
  onSaveAsTemplate,
  onExportAll,
  t,
}: ProfilesSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('terminal.sectionProfiles')}</h2>
        <p className="text-sm text-muted-foreground">{t('terminal.sectionProfilesDesc')}</p>
      </div>

      <TerminalProfileList
        profiles={terminal.profiles}
        onLaunch={terminal.launchProfile}
        onEdit={onEdit}
        onDelete={terminal.deleteProfile}
        onSetDefault={terminal.setDefaultProfile}
        onCreateNew={onCreateNew}
        onDuplicate={terminal.duplicateProfile}
        onExportAll={onExportAll}
        onImport={terminal.importProfiles}
        onFromTemplate={onFromTemplate}
        onSaveAsTemplate={onSaveAsTemplate}
        launchingProfileId={terminal.launchingProfileId}
        lastLaunchResult={terminal.lastLaunchResult}
        onClearLaunchResult={terminal.clearLaunchResult}
      />
    </div>
  );
}

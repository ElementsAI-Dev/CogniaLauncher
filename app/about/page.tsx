'use client';

import { useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { useAboutData } from '@/hooks/use-about-data';
import { getChangelog } from '@/lib/constants/about';
import {
  VersionCards,
  UpdateBanner,
  SystemInfoCard,
  BuildDepsCard,
  LicenseCard,
  ActionsCard,
  ErrorAlert,
  ChangelogDialog,
} from '@/components/about';

export default function AboutPage() {
  const { t, locale } = useLocale();
  const [changelogOpen, setChangelogOpen] = useState(false);
  
  const {
    updateInfo,
    loading,
    updating,
    updateProgress,
    updateStatus,
    error,
    systemError,
    systemInfo,
    systemLoading,
    isDesktop,
    checkForUpdate,
    reloadSystemInfo,
    handleUpdate,
    clearError,
    exportDiagnostics,
  } = useAboutData(locale);

  const changelogEntries = getChangelog(locale);

  return (
    <main className="p-6 space-y-6" aria-labelledby="about-page-title">
      <PageHeader
        title={<span id="about-page-title">{t('about.pageTitle')}</span>}
        description={t('about.pageDescription')}
      />

      {/* Error Alert */}
      <ErrorAlert 
        error={error} 
        onRetry={checkForUpdate} 
        onDismiss={clearError} 
        t={t} 
      />

      {/* Version Cards Row */}
      <section aria-label={t('about.versionInfo')}>
        <VersionCards loading={loading} updateInfo={updateInfo} t={t} />
      </section>

      {/* Update Available Banner */}
      <UpdateBanner
        updateInfo={updateInfo}
        updating={updating}
        updateProgress={updateProgress}
        updateStatus={updateStatus}
        isDesktop={isDesktop}
        onUpdate={() => handleUpdate(t)}
        t={t}
      />

      {/* System Information Card */}
      <section aria-label={t('about.systemInfo')}>
        <SystemInfoCard
          systemInfo={systemInfo}
          systemLoading={systemLoading}
          updateInfo={updateInfo}
          systemError={systemError}
          onRetry={reloadSystemInfo}
          t={t}
        />
      </section>

      {/* Build Dependencies Card */}
      <section aria-label={t('about.buildDependencies')}>
        <BuildDepsCard t={t} />
      </section>

      {/* License & Certificates Card */}
      <section aria-label={t('about.licenseCertificates')}>
        <LicenseCard t={t} />
      </section>

      {/* Actions Card */}
      <section aria-label={t('about.actions')}>
        <ActionsCard
          loading={loading}
          isDesktop={isDesktop}
          onCheckUpdate={checkForUpdate}
          onOpenChangelog={() => setChangelogOpen(true)}
          onExportDiagnostics={() => exportDiagnostics(t)}
          t={t}
        />
      </section>

      {/* Changelog Dialog */}
      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        entries={changelogEntries}
        t={t}
      />
    </main>
  );
}

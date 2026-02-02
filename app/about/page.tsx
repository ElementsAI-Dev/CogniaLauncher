'use client';

import { useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { useAboutData } from './_hooks/use-about-data';
import {
  VersionCards,
  UpdateBanner,
  SystemInfoCard,
  BuildDepsCard,
  LicenseCard,
  ActionsCard,
  ErrorAlert,
  ChangelogDialog,
} from './_components';

export default function AboutPage() {
  const { t, locale } = useLocale();
  const [changelogOpen, setChangelogOpen] = useState(false);
  
  const {
    updateInfo,
    loading,
    updating,
    updateProgress,
    error,
    systemInfo,
    systemLoading,
    checkForUpdate,
    handleUpdate,
    clearError,
  } = useAboutData(locale);

  return (
    <main className="p-6 space-y-6" aria-labelledby="about-page-title">
      {/* Page Header */}
      <header className="space-y-1">
        <h1 id="about-page-title" className="text-[28px] font-bold text-foreground">
          {t('about.pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('about.pageDescription')}</p>
      </header>

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
        onUpdate={() => handleUpdate(t)}
        t={t}
      />

      {/* System Information Card */}
      <section aria-label={t('about.systemInfo')}>
        <SystemInfoCard
          systemInfo={systemInfo}
          systemLoading={systemLoading}
          updateInfo={updateInfo}
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
          onCheckUpdate={checkForUpdate}
          onOpenChangelog={() => setChangelogOpen(true)}
          t={t}
        />
      </section>

      {/* Changelog Dialog */}
      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        t={t}
      />
    </main>
  );
}

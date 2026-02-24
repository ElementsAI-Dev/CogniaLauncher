'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { useAboutData } from '@/hooks/use-about-data';
import { useChangelog } from '@/hooks/use-changelog';
import { useChangelogStore } from '@/lib/stores/changelog';
import { compareSemver } from '@/lib/constants/changelog-utils';
import { APP_VERSION } from '@/lib/app-version';
import {
  VersionCards,
  UpdateBanner,
  SystemInfoCard,
  BuildDepsCard,
  LicenseCard,
  ActionsCard,
  ErrorAlert,
  ChangelogDialog,
  WhatsNewDialog,
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

  const changelog = useChangelog(locale);

  const { lastSeenVersion, whatsNewOpen, setWhatsNewOpen, dismissWhatsNew } =
    useChangelogStore();

  // Auto-show "What's New" if the user hasn't seen this version yet
  useEffect(() => {
    if (!lastSeenVersion) {
      // First-time user: seed with current version so future upgrades are detected
      dismissWhatsNew(APP_VERSION);
    } else if (lastSeenVersion !== APP_VERSION) {
      setWhatsNewOpen(true);
    }
  }, [lastSeenVersion, setWhatsNewOpen, dismissWhatsNew]);

  // Filter entries newer than lastSeenVersion for "What's New"
  const whatsNewEntries = changelog.entries.filter((entry) => {
    if (!lastSeenVersion) return false;
    return compareSemver(entry.version, lastSeenVersion) > 0;
  });

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
        entries={changelog.entries}
        loading={changelog.loading}
        error={changelog.error}
        onRetry={changelog.refresh}
        t={t}
      />

      {/* What's New Dialog */}
      <WhatsNewDialog
        open={whatsNewOpen}
        onOpenChange={(open) => {
          if (!open) {
            dismissWhatsNew(APP_VERSION);
          } else {
            setWhatsNewOpen(open);
          }
        }}
        entries={whatsNewEntries}
        loading={changelog.loading}
        onDismiss={() => dismissWhatsNew(APP_VERSION)}
        onShowFullChangelog={() => {
          dismissWhatsNew(APP_VERSION);
          setChangelogOpen(true);
        }}
        t={t}
      />
    </main>
  );
}

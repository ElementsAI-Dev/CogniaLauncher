'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { useAboutData } from '@/hooks/use-about-data';
import { useChangelog } from '@/hooks/use-changelog';
import { useChangelogStore } from '@/lib/stores/changelog';
import { useFeedbackStore } from '@/lib/stores/feedback';
import { compareVersions } from '@/lib/constants/changelog-utils';
import { APP_VERSION } from '@/lib/app-version';
import { buildAboutSupportState } from '@/lib/about-support';
import {
  VersionCards,
  UpdateBanner,
  AboutSupportOverviewCard,
  SystemInfoCard,
  AboutInsightsCard,
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
  const { openDialog } = useFeedbackStore();
  
  const {
    updateInfo,
    loading,
    updating,
    updateProgress,
    updateStatus,
    updateErrorCategory,
    error,
    systemError,
    systemInfo,
    systemLoading,
    aboutInsights,
    insightsLoading,
    supportFreshness,
    supportRefreshing,
    isDesktop,
    checkForUpdate,
    reloadSystemInfo,
    reloadAboutInsights,
    refreshAllSupportData,
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
    return compareVersions(entry.version, lastSeenVersion) > 0;
  });

  const supportState = buildAboutSupportState({
    isDesktop,
    loading,
    systemLoading,
    insightsLoading,
    updateInfo,
    updateStatus,
    updateErrorCategory,
    systemError,
    systemInfo,
    aboutInsights,
    supportFreshness,
  });

  return (
    <main className="p-4 md:p-6 space-y-6" aria-labelledby="about-page-title">
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

      {/* Summary Section */}
      <section
        aria-labelledby="about-summary-heading"
        className="space-y-4"
        data-testid="about-summary-section"
      >
        <h2 id="about-summary-heading" className="sr-only">{t("about.versionInfo")}</h2>
        <VersionCards loading={loading} updateInfo={updateInfo} t={t} />
        <UpdateBanner
          updateInfo={updateInfo}
          updating={updating}
          updateProgress={updateProgress}
          updateStatus={updateStatus}
          isDesktop={isDesktop}
          onUpdate={() => handleUpdate(t)}
          t={t}
        />
      </section>

      {/* Diagnostics Section */}
      <section
        aria-labelledby="about-support-heading"
        className="space-y-4"
        data-testid="about-support-section"
      >
        <h2 id="about-support-heading" className="sr-only">
          {t("about.supportOverviewTitle")}
        </h2>
        <AboutSupportOverviewCard
          supportState={supportState}
          supportRefreshing={supportRefreshing}
          locale={locale}
          onRefreshAll={refreshAllSupportData}
          onOpenChangelog={() => setChangelogOpen(true)}
          onExportDiagnostics={() => exportDiagnostics(t)}
          onReportBug={() => openDialog({ category: "bug" })}
          t={t}
        />
      </section>

      <section
        aria-labelledby="about-diagnostics-heading"
        className="space-y-4"
        data-testid="about-diagnostics-section"
      >
        <h2 id="about-diagnostics-heading" className="sr-only">
          {t("about.systemInfo")} / {t("about.insightsTitle")}
        </h2>
        <div
          className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start"
          data-testid="about-diagnostics-grid"
        >
          <section aria-label={t('about.systemInfo')}>
            <SystemInfoCard
              systemInfo={systemInfo}
              systemLoading={systemLoading}
              aboutInsights={aboutInsights}
              updateInfo={updateInfo}
              systemError={systemError}
              locale={locale}
              lastRefreshedAt={supportFreshness.systemInfoRefreshedAt}
              onRetry={reloadSystemInfo}
              t={t}
            />
          </section>
          <section aria-label={t("about.insightsTitle")}>
            <AboutInsightsCard
              insights={aboutInsights}
              insightsLoading={insightsLoading}
              locale={locale}
              lastGeneratedAt={supportFreshness.insightsGeneratedAt}
              onRetry={reloadAboutInsights}
              t={t}
            />
          </section>
        </div>
      </section>

      {/* Reference And Actions Section */}
      <section
        aria-labelledby="about-reference-heading"
        className="space-y-4"
        data-testid="about-reference-section"
      >
        <h2 id="about-reference-heading" className="sr-only">
          {t("about.buildDependencies")} / {t("about.licenseCertificates")} / {t("about.actions")}
        </h2>
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
          data-testid="about-reference-grid"
        >
          <section aria-label={t('about.buildDependencies')}>
            <BuildDepsCard t={t} />
          </section>
          <section aria-label={t('about.licenseCertificates')}>
            <LicenseCard t={t} />
          </section>
        </div>
        <section aria-label={t('about.actions')}>
          <ActionsCard
            loading={loading || supportRefreshing}
            isDesktop={isDesktop}
            onCheckUpdate={checkForUpdate}
            onOpenChangelog={() => setChangelogOpen(true)}
            onExportDiagnostics={() => exportDiagnostics(t)}
            t={t}
          />
        </section>
      </section>

      {/* Changelog Dialog */}
      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        locale={locale}
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
        locale={locale}
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

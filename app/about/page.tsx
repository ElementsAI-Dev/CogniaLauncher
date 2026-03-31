'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAboutData } from '@/hooks/about/use-about-data';
import { useChangelog } from '@/hooks/about/use-changelog';
import { useChangelogStore } from '@/lib/stores/changelog';
import { useFeedbackStore } from '@/lib/stores/feedback';
import { compareVersions } from '@/lib/constants/changelog-utils';
import { APP_VERSION } from '@/lib/app-version';
import { buildAboutSupportState } from '@/lib/about-support';
import { toast } from 'sonner';
import {
  RefreshCw,
  FileText,
  ClipboardList,
  Bug,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  VersionCards,
  UpdateBanner,
  AboutSupportOverviewCard,
  SystemInfoCard,
  AboutInsightsCard,
  AboutProductContextCard,
  BuildDepsCard,
  LicenseCard,
  ErrorAlert,
  ChangelogDialog,
  WhatsNewDialog,
} from '@/components/about';

export default function AboutPage() {
  const { t, locale } = useLocale();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [productContextOpen, setProductContextOpen] = useState(false);
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

  const handleRefreshAll = async () => {
    try {
      await refreshAllSupportData();
      toast.success(t("about.refreshComplete"));
    } catch {
      toast.error(t("about.refreshFailed"));
    }
  };

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

      {/* Version Strip + Quick Actions */}
      <section
        aria-labelledby="about-summary-heading"
        className="space-y-3"
        data-testid="about-summary-section"
      >
        <h2 id="about-summary-heading" className="sr-only">{t("about.versionInfo")}</h2>
        <VersionCards
          loading={loading}
          updateInfo={updateInfo}
          updateStatus={updateStatus}
          t={t}
        />

        {/* Quick Actions Row */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("about.quickActions")}
          data-testid="about-quick-actions"
        >
          <Button
            size="sm"
            onClick={checkForUpdate}
            disabled={loading || supportRefreshing}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t("about.checkForUpdates")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChangelogOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {t("about.changelog")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportDiagnostics(t)}
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            {t("about.exportDiagnostics")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDialog({ category: "bug" })}
          >
            <Bug className="h-3.5 w-3.5" aria-hidden="true" />
            {t("about.reportBug")}
          </Button>
        </div>

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
          onRefreshAll={handleRefreshAll}
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

      {/* Reference Section */}
      <section
        aria-labelledby="about-reference-heading"
        className="space-y-4"
        data-testid="about-reference-section"
      >
        <h2 id="about-reference-heading" className="sr-only">
          {t("about.buildDependencies")} / {t("about.licenseCertificates")}
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

        {/* Product Context (collapsed by default) */}
        <Collapsible open={productContextOpen} onOpenChange={setProductContextOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" aria-hidden="true" />
                {t("about.productContextTitle")}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${productContextOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <section aria-label={t("about.productContextTitle")} className="mt-2">
              <AboutProductContextCard isDesktop={isDesktop} t={t} />
            </section>
          </CollapsibleContent>
        </Collapsible>
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
        previousVersion={lastSeenVersion || undefined}
        loading={changelog.loading}
        error={changelog.error}
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

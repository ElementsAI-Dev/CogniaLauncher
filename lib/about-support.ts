import type { SelfUpdateInfo } from "@/lib/tauri";
import type {
  AboutInsights,
  AboutSupportAction,
  AboutSupportFreshness,
  AboutSupportIssue,
  AboutSupportState,
  SystemInfo,
  UpdateErrorCategory,
  UpdateStatus,
} from "@/types/about";

export interface BuildAboutSupportStateInput {
  isDesktop: boolean;
  loading: boolean;
  systemLoading: boolean;
  insightsLoading: boolean;
  updateInfo: SelfUpdateInfo | null;
  updateStatus: UpdateStatus;
  updateErrorCategory: UpdateErrorCategory | null;
  systemError: string | null;
  systemInfo: Pick<SystemInfo, "sectionSummary"> | null;
  aboutInsights: AboutInsights | null;
  supportFreshness: AboutSupportFreshness;
}

function addIssue(
  issues: AboutSupportIssue[],
  nextIssue: AboutSupportIssue,
): void {
  if (issues.some((issue) => issue.id === nextIssue.id)) {
    return;
  }
  issues.push(nextIssue);
}

function addAction(
  actions: AboutSupportAction[],
  action: AboutSupportAction,
): void {
  if (actions.some((item) => item.id === action.id)) {
    return;
  }
  actions.push(action);
}

export function getLatestTimestamp(
  ...timestamps: Array<string | null | undefined>
): string | null {
  const values = timestamps.filter((value): value is string => typeof value === "string");
  if (values.length === 0) {
    return null;
  }

  return values.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

export function buildAboutSupportState({
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
}: BuildAboutSupportStateInput): AboutSupportState {
  const degradedSectionIds = new Set<string>();
  const issues: AboutSupportIssue[] = [];
  const recommendedActions: AboutSupportAction[] = [];

  if (updateStatus === "error" || updateErrorCategory) {
    degradedSectionIds.add("update");
    addIssue(issues, {
      id: "update_error",
      severity: "degraded",
      source: "update",
    });
  }

  if (systemError) {
    degradedSectionIds.add("system");
    addIssue(issues, {
      id: "system_error",
      severity: "degraded",
      source: "system",
    });
  }

  for (const [sectionId, summary] of Object.entries(systemInfo?.sectionSummary ?? {})) {
    if (!summary) {
      continue;
    }

    if (summary.status === "failed" || (summary.status === "unavailable" && isDesktop)) {
      degradedSectionIds.add(sectionId);
      addIssue(issues, {
        id: `${sectionId}_degraded`,
        severity: "degraded",
        source: "system",
      });
    }
  }

  for (const [sectionId, status] of Object.entries(aboutInsights?.sections ?? {})) {
    if (status === "failed" || (status === "unavailable" && isDesktop)) {
      degradedSectionIds.add(sectionId);
      addIssue(issues, {
        id: `${sectionId}_degraded`,
        severity: "degraded",
        source: "insights",
      });
    }
  }

  if (updateInfo?.update_available) {
    addIssue(issues, {
      id: "update_available",
      severity: "attention",
      source: "update",
    });
  }

  if ((aboutInsights?.providerSummary.unsupported ?? 0) > 0) {
    addIssue(issues, {
      id: "unsupported_providers",
      severity: "attention",
      source: "providers",
    });
  }

  if (updateInfo?.update_available || updateStatus === "error") {
    addAction(recommendedActions, {
      id: "open_changelog",
      kind: "dialog",
    });
  }

  if (
    aboutInsights?.sections.providers === "failed" ||
    (aboutInsights?.providerSummary.unsupported ?? 0) > 0
  ) {
    addAction(recommendedActions, {
      id: "open_providers",
      kind: "route",
      href: "/providers",
    });
  }

  if (aboutInsights?.sections.logs === "failed") {
    addAction(recommendedActions, {
      id: "open_logs",
      kind: "route",
      href: "/logs",
    });
  }

  if (aboutInsights?.sections.cache === "failed") {
    addAction(recommendedActions, {
      id: "open_cache",
      kind: "route",
      href: "/cache",
    });
  }

  if (issues.length > 0 || degradedSectionIds.size > 0) {
    addAction(recommendedActions, {
      id: "export_diagnostics",
      kind: "callback",
    });
    addAction(recommendedActions, {
      id: "report_bug",
      kind: "callback",
    });
  }

  const freshness = {
    ...supportFreshness,
    latestSuccessfulAt:
      supportFreshness.latestSuccessfulAt ??
      getLatestTimestamp(
        supportFreshness.updateCheckedAt,
        supportFreshness.systemInfoRefreshedAt,
        supportFreshness.insightsGeneratedAt,
      ),
  };

  const hasDegraded = degradedSectionIds.size > 0;
  const hasAttention = issues.some((issue) => issue.severity === "attention");
  const health =
    loading && systemLoading && insightsLoading && !freshness.latestSuccessfulAt
      ? "loading"
      : hasDegraded
        ? "degraded"
        : hasAttention
          ? "attention"
          : "ready";

  const diagnosticsBlockingSections = [...degradedSectionIds].filter(
    (sectionId) => sectionId !== "update",
  );

  return {
    health,
    issueCount: issues.length,
    diagnosticsReady:
      Boolean(systemInfo && aboutInsights) && diagnosticsBlockingSections.length === 0,
    degradedSectionIds: [...degradedSectionIds],
    issues,
    recommendedActions,
    freshness,
  };
}

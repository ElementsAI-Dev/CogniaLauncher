import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/link", () => {
  return function MockLink({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string }>) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

jest.mock("@/lib/stores/feedback", () => ({
  useFeedbackStore: () => ({ openDialog: jest.fn() }),
}));

jest.mock("@/lib/tauri", () => ({
  openExternal: jest.fn(),
}));

const mockT = (
  key: string,
  params?: Record<string, string | number>,
) => {
  const translations: Record<string, string> = {
    "about.supportOverviewTitle": "Support Overview",
    "about.supportOverviewDesc": "Top-level support readiness and next steps",
    "about.supportHealthReady": "Ready",
    "about.supportHealthAttention": "Attention",
    "about.supportHealthDegraded": "Degraded",
    "about.supportHealthLoading": "Loading",
    "about.supportSummaryReady": "Support data is healthy.",
    "about.supportSummaryAttention": "There are attention items to review.",
    "about.supportSummaryDegraded": "Some support data is degraded.",
    "about.supportSummaryLoading": "Support data is still loading.",
    "about.supportIssueCount": `${params?.count ?? 0} issues`,
    "about.supportDiagnosticsReady": "Diagnostics ready",
    "about.supportDiagnosticsDegraded": "Diagnostics partial",
    "about.supportLatestActivity": "Latest activity",
    "about.supportUpdateCheckedAt": "Updates checked",
    "about.supportSystemRefreshedAt": "System refreshed",
    "about.supportInsightsGeneratedAt": "Insights generated",
    "about.supportDegradedSections": "Needs follow-up",
    "about.supportRecommendedActions": "Recommended actions",
    "about.supportRefreshAll": "Refresh all support data",
    "about.supportActionOpenChangelog": "Review changelog",
    "about.supportActionOpenProviders": "Open providers",
    "about.supportActionOpenLogs": "Open logs",
    "about.supportActionOpenCache": "Open cache",
    "about.supportActionExportDiagnostics": "Export diagnostics",
    "about.supportActionReportBug": "Report bug",
    "about.supportSectionUpdate": "Update",
    "about.supportSectionSystem": "System",
    "about.supportSectionNetworks": "Networks",
    "about.supportSectionProviders": "Providers",
    "about.supportSectionLogs": "Logs",
    "about.supportSectionCache": "Cache",
    "about.openInNewTab": "Open in new tab",
    "about.repository": "Repository",
    "about.documentation": "Documentation",
    "about.featureRequest": "Feature Request",
    "common.unknown": "Unknown",
  };

  return translations[key] || key;
};

function loadAboutSupportOverviewCard():
  | {
      AboutSupportOverviewCard?: React.ComponentType<Record<string, unknown>>;
    }
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./about-support-overview-card");
  } catch {
    return null;
  }
}

const defaultProps = {
  locale: "en-US",
  supportRefreshing: false,
  supportState: {
    health: "degraded" as const,
    issueCount: 4,
    diagnosticsReady: false,
    degradedSectionIds: ["update", "providers", "logs"],
    issues: [
      { id: "update_error", severity: "degraded" as const, source: "update" as const },
    ],
    recommendedActions: [
      { id: "open_changelog" as const, kind: "dialog" as const },
      { id: "open_providers" as const, kind: "route" as const, href: "/providers" },
      { id: "open_logs" as const, kind: "route" as const, href: "/logs" },
      { id: "export_diagnostics" as const, kind: "callback" as const },
      { id: "report_bug" as const, kind: "callback" as const },
    ],
    freshness: {
      updateCheckedAt: "2026-03-14T09:00:00.000Z",
      systemInfoRefreshedAt: "2026-03-14T09:01:00.000Z",
      insightsGeneratedAt: "2026-03-14T09:02:00.000Z",
      latestSuccessfulAt: "2026-03-14T09:02:00.000Z",
    },
  },
  onRefreshAll: jest.fn(),
  onOpenChangelog: jest.fn(),
  onExportDiagnostics: jest.fn(),
  onReportBug: jest.fn(),
  t: mockT,
};

describe("AboutSupportOverviewCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders support overview summary, status, and refresh action", () => {
    const loadedCard = loadAboutSupportOverviewCard();
    expect(loadedCard?.AboutSupportOverviewCard).toBeDefined();
    if (!loadedCard?.AboutSupportOverviewCard) return;

    const Component = loadedCard.AboutSupportOverviewCard;
    render(<Component {...defaultProps} />);

    expect(screen.getByText("Support Overview")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("Some support data is degraded.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh all support data" }),
    ).toBeInTheDocument();
  });

  it("renders degraded sections and freshness labels", () => {
    const loadedCard = loadAboutSupportOverviewCard();
    expect(loadedCard?.AboutSupportOverviewCard).toBeDefined();
    if (!loadedCard?.AboutSupportOverviewCard) return;

    const Component = loadedCard.AboutSupportOverviewCard;
    render(<Component {...defaultProps} />);

    expect(screen.getByText("Needs follow-up")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
    expect(screen.getByText("Updates checked")).toBeInTheDocument();
    expect(screen.getByText("System refreshed")).toBeInTheDocument();
    expect(screen.getByText("Insights generated")).toBeInTheDocument();
  });

  it("routes and triggers contextual actions", async () => {
    const loadedCard = loadAboutSupportOverviewCard();
    expect(loadedCard?.AboutSupportOverviewCard).toBeDefined();
    if (!loadedCard?.AboutSupportOverviewCard) return;

    const Component = loadedCard.AboutSupportOverviewCard;
    render(<Component {...defaultProps} />);

    expect(screen.getByRole("link", { name: "Open providers" })).toHaveAttribute(
      "href",
      "/providers",
    );
    expect(screen.getByRole("link", { name: "Open logs" })).toHaveAttribute(
      "href",
      "/logs",
    );

    await userEvent.click(screen.getByRole("button", { name: "Refresh all support data" }));
    await userEvent.click(screen.getByRole("button", { name: "Review changelog" }));
    await userEvent.click(screen.getByRole("button", { name: "Export diagnostics" }));
    await userEvent.click(screen.getByRole("button", { name: "Report bug" }));

    expect(defaultProps.onRefreshAll).toHaveBeenCalledTimes(1);
    expect(defaultProps.onOpenChangelog).toHaveBeenCalledTimes(1);
    expect(defaultProps.onExportDiagnostics).toHaveBeenCalledTimes(1);
    expect(defaultProps.onReportBug).toHaveBeenCalledTimes(1);
  });
});

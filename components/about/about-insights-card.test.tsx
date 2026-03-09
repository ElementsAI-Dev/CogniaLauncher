import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AboutInsightsCard } from "./about-insights-card";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.insightsTitle": "Runtime Insights",
    "about.insightsDesc": "Support-facing runtime summary",
    "about.insightsRetry": "Refresh insights",
    "about.insightsRuntimeMode": "Runtime Mode",
    "about.insightsRuntimeDesktop": "Desktop",
    "about.insightsRuntimeWeb": "Web",
    "about.insightsProviderSummary": "Providers (installed/total)",
    "about.insightsLogsSize": "Log Size",
    "about.insightsCacheSize": "Cache Size",
    "about.insightsGroupProviders": "Providers",
    "about.insightsGroupLogs": "Logs",
    "about.insightsGroupCache": "Cache",
    "about.insightsStatusLoading": "Loading",
    "about.insightsStatusOk": "OK",
    "about.insightsStatusFailed": "Failed",
    "about.insightsStatusUnavailable": "Unavailable",
    "common.unknown": "Unknown",
  };
  return translations[key] || key;
};

const baseInsights = {
  runtimeMode: "desktop" as const,
  providerSummary: {
    total: 10,
    installed: 6,
    supported: 9,
    unsupported: 1,
  },
  storageSummary: {
    cacheTotalSizeHuman: "3.0 MB",
    logTotalSizeBytes: 1048576,
    logTotalSizeHuman: "1.0 MB",
  },
  sections: {
    providers: "ok" as const,
    logs: "ok" as const,
    cache: "ok" as const,
  },
  generatedAt: "2026-03-08T00:00:00.000Z",
};

describe("AboutInsightsCard", () => {
  it("renders heading and description", () => {
    render(
      <AboutInsightsCard
        insights={baseInsights}
        insightsLoading={false}
        onRetry={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Runtime Insights")).toBeInTheDocument();
    expect(
      screen.getByText("Support-facing runtime summary"),
    ).toBeInTheDocument();
  });

  it("renders runtime and summary values", () => {
    render(
      <AboutInsightsCard
        insights={baseInsights}
        insightsLoading={false}
        onRetry={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("6/10")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
    expect(screen.getByText("3.0 MB")).toBeInTheDocument();
  });

  it("renders fallback state labels when groups fail", () => {
    render(
      <AboutInsightsCard
        insights={{
          ...baseInsights,
          sections: {
            providers: "failed",
            logs: "unavailable",
            cache: "ok",
          },
        }}
        insightsLoading={false}
        onRetry={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading skeletons when loading", () => {
    const { container } = render(
      <AboutInsightsCard
        insights={null}
        insightsLoading={true}
        onRetry={jest.fn()}
        t={mockT}
      />,
    );

    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("renders standardized empty state when insights are unavailable", () => {
    render(
      <AboutInsightsCard
        insights={null}
        insightsLoading={false}
        onRetry={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Refresh insights" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("calls onRetry when refresh button is clicked", async () => {
    const onRetry = jest.fn();
    render(
      <AboutInsightsCard
        insights={baseInsights}
        insightsLoading={false}
        onRetry={onRetry}
        t={mockT}
      />,
    );

    await userEvent.click(screen.getByLabelText("Refresh insights"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import { WorkspaceTrendsWidget } from "./workspace-trends-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("WorkspaceTrendsWidget", () => {
  it("renders trend data for the selected metric", () => {
    render(
      <WorkspaceTrendsWidget
        model={{
          range: "7d",
          metric: "downloads",
          viewMode: "comparison",
          isUsingSharedRange: true,
          points: [
            { label: "2026-03-13", value: 2, downloads: 2, installations: 1, updates: 0 },
            { label: "2026-03-14", value: 4, downloads: 4, installations: 2, updates: 1 },
          ],
          isLoading: false,
          error: null,
          lastUpdatedAt: "2026-03-14T12:00:00.000Z",
          missingSources: [],
          isPartial: false,
        }}
      />,
    );

    expect(screen.getByText("dashboard.widgets.workspaceTrends")).toBeInTheDocument();
    expect(screen.getAllByText("dashboard.widgets.settingsMetric_downloads").length).toBeGreaterThan(0);
    expect(screen.getByTestId("workspace-trends-shared-scope")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.settingsViewMode_comparison")).toBeInTheDocument();
  });

  it("renders an empty state when there are no trend points", () => {
    render(
      <WorkspaceTrendsWidget
        model={{
          range: "7d",
          metric: "installations",
          viewMode: "single",
          isUsingSharedRange: false,
          points: [],
          isLoading: false,
          error: null,
          lastUpdatedAt: null,
          missingSources: ["downloads"],
          isPartial: false,
        }}
      />,
    );

    expect(screen.getByText("dashboard.widgets.workspaceTrendsEmpty")).toBeInTheDocument();
  });
});

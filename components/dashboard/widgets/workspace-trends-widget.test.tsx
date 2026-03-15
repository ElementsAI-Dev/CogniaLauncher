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
          points: [
            { label: "2026-03-13", value: 2 },
            { label: "2026-03-14", value: 4 },
          ],
          isLoading: false,
          error: null,
          lastUpdatedAt: "2026-03-14T12:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("dashboard.widgets.workspaceTrends")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.settingsMetric_downloads")).toBeInTheDocument();
  });

  it("renders an empty state when there are no trend points", () => {
    render(
      <WorkspaceTrendsWidget
        model={{
          range: "7d",
          metric: "installations",
          points: [],
          isLoading: false,
          error: null,
          lastUpdatedAt: null,
        }}
      />,
    );

    expect(screen.getByText("dashboard.widgets.workspaceTrendsEmpty")).toBeInTheDocument();
  });
});

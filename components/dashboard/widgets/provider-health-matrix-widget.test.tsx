import { render, screen } from "@testing-library/react";
import { ProviderHealthMatrixWidget } from "./provider-health-matrix-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("ProviderHealthMatrixWidget", () => {
  it("renders health cells and summary totals", () => {
    render(
      <ProviderHealthMatrixWidget
        model={{
          groupBy: "provider",
          showHealthy: true,
          viewMode: "heatmap",
          cells: [
            {
              id: "provider:npm",
              label: "npm",
              status: "warning",
              issueCount: 1,
              href: "/health",
              checkedAt: "2026-03-14T12:00:00.000Z",
            },
            {
              id: "provider:pnpm",
              label: "pnpm",
              status: "healthy",
              issueCount: 0,
              href: "/health",
              checkedAt: "2026-03-14T12:00:00.000Z",
            },
          ],
          totals: {
            healthy: 1,
            warning: 1,
            error: 0,
            unknown: 0,
          },
          isLoading: false,
          error: null,
          lastUpdatedAt: "2026-03-14T12:00:00.000Z",
          missingSources: [],
          isPartial: false,
        }}
      />,
    );

    expect(screen.getByText("npm")).toBeInTheDocument();
    expect(screen.getByText("pnpm")).toBeInTheDocument();
    expect(screen.getByText("1 issue(s)")).toBeInTheDocument();
    expect(screen.getByTestId("provider-health-matrix-heatmap")).toBeInTheDocument();
  });

  it("renders an empty state when no health cells are available", () => {
    render(
      <ProviderHealthMatrixWidget
        model={{
          groupBy: "provider",
          showHealthy: false,
          viewMode: "status-list",
          cells: [],
          totals: {
            healthy: 0,
            warning: 0,
            error: 0,
            unknown: 0,
          },
          isLoading: false,
          error: null,
          lastUpdatedAt: null,
          missingSources: ["health"],
          isPartial: false,
        }}
      />,
    );

    expect(screen.getByText("dashboard.widgets.providerHealthMatrixEmpty")).toBeInTheDocument();
  });
});

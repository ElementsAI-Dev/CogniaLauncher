import { render, screen } from "@testing-library/react";
import { AttentionCenterWidget } from "./attention-center-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string, params?: Record<string, string | number>) => {
    if (params?.count) {
      return `${key}:${params.count}`;
    }
    return key;
  } }),
}));

describe("AttentionCenterWidget", () => {
  it("renders prioritized attention items with deep links", () => {
    render(
      <AttentionCenterWidget
        model={{
          items: [
            {
              id: "health",
              source: "health",
              severity: "danger",
              title: "Health checks need attention",
              description: "2 issues detected",
              href: "/health",
            },
            {
              id: "downloads",
              source: "downloads",
              severity: "warning",
              title: "Downloads need review",
              description: "1 failed download",
              href: "/downloads",
            },
          ],
          totalCount: 2,
          isLoading: false,
          error: null,
          lastUpdatedAt: "2026-03-14T12:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Health checks need attention")).toBeInTheDocument();
    expect(screen.getByText("Downloads need review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Health checks need attention/i })).toHaveAttribute("href", "/health");
    expect(screen.getByRole("link", { name: /Downloads need review/i })).toHaveAttribute("href", "/downloads");
  });

  it("renders a calm empty state when no attention items exist", () => {
    render(
      <AttentionCenterWidget
        model={{
          items: [],
          totalCount: 0,
          isLoading: false,
          error: null,
          lastUpdatedAt: null,
        }}
      />,
    );

    expect(screen.getByText("dashboard.widgets.attentionCenterClear")).toBeInTheDocument();
  });
});

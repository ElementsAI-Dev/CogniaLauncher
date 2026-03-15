import { render, screen } from "@testing-library/react";
import { RecentActivityFeedWidget } from "./recent-activity-feed-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("RecentActivityFeedWidget", () => {
  it("renders recent activity rows with source context", () => {
    render(
      <RecentActivityFeedWidget
        model={{
          items: [
            {
              id: "download:1",
              source: "downloads",
              title: "node-v20.zip",
              description: "Download failed",
              timestamp: "2026-03-14T11:42:00.000Z",
              href: "/downloads",
            },
            {
              id: "package:1",
              source: "packages",
              title: "install typescript",
              description: "npm 5.9.0",
              timestamp: "2026-03-14T10:00:00.000Z",
              href: "/packages",
            },
          ],
          totalCount: 2,
          isLoading: false,
          error: null,
          lastUpdatedAt: "2026-03-14T11:42:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("node-v20.zip")).toBeInTheDocument();
    expect(screen.getByText("install typescript")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /node-v20.zip/i })).toHaveAttribute("href", "/downloads");
  });

  it("renders an empty state when there is no recent activity", () => {
    render(
      <RecentActivityFeedWidget
        model={{
          items: [],
          totalCount: 0,
          isLoading: false,
          error: null,
          lastUpdatedAt: null,
        }}
      />,
    );

    expect(screen.getByText("dashboard.widgets.recentActivityEmpty")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { MarketplaceListingCard } from "./marketplace-listing-card";
import type { ToolboxMarketplaceResolvedListing } from "@/types/toolbox-marketplace";

jest.mock("next/link", () => {
  const MockLink = ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>;
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/toolbox-route", () => ({
  getToolboxDetailPath: () => "/toolbox/plugin:demo",
}));

describe("MarketplaceListingCard", () => {
  it("renders richer publisher and adoption signals when metadata is available", () => {
    const listing: ToolboxMarketplaceResolvedListing = {
      id: "demo-listing",
      pluginId: "com.example.demo",
      name: "Demo Listing",
      description: "Demo plugin description.",
      version: "1.2.3",
      category: "developer",
      featured: true,
      authors: ["Example"],
      updatedAt: "2026-03-06T00:00:00.000Z",
      installCount: 2048,
      publisher: {
        id: "example",
        name: "Example Labs",
        verified: true,
        url: "https://example.invalid/publisher",
      },
      support: {
        homepageUrl: null,
        documentationUrl: null,
        issuesUrl: null,
      },
      highlights: ["Fast onboarding"],
      gallery: [],
      releaseNotes: null,
      minimumHostVersion: "0.1.0",
      toolContractVersion: "1.0.0",
      source: {
        type: "store",
        storeId: "demo-listing",
        pluginDir: "marketplace/demo-listing",
        artifact: "plugin.wasm",
        checksumSha256: "abc",
        downloadUrl: null,
        mirrorUrls: [],
        sizeBytes: null,
      },
      permissions: [],
      capabilities: [],
      tools: [
        {
          toolId: "demo",
          name: "Demo Tool",
          description: "Runs the demo flow.",
          category: "developer",
          uiMode: "text",
        },
      ],
      desktopOnly: true,
      installState: "not-installed",
      blockedReason: null,
      compatible: true,
      installedPlugin: null,
      pendingUpdate: null,
    };

    render(
      <MarketplaceListingCard
        listing={listing}
        onInstall={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByText("Example Labs")).toBeInTheDocument();
    expect(
      screen.getByText("toolbox.marketplace.verifiedPublisher"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("toolbox.marketplace.installCount"),
    ).toBeInTheDocument();
  });

  it("uses locale-driven busy labels for marketplace actions", () => {
    const listing: ToolboxMarketplaceResolvedListing = {
      id: "demo-listing",
      pluginId: "com.example.demo",
      name: "Demo Listing",
      description: "Demo plugin description.",
      version: "1.2.3",
      category: "developer",
      featured: false,
      authors: ["Example"],
      updatedAt: "2026-03-06T00:00:00.000Z",
      installCount: 10,
      publisher: null,
      support: {
        homepageUrl: null,
        documentationUrl: null,
        issuesUrl: null,
      },
      highlights: [],
      gallery: [],
      releaseNotes: null,
      minimumHostVersion: "0.1.0",
      toolContractVersion: "1.0.0",
      source: {
        type: "store",
        storeId: "demo-listing",
        pluginDir: "marketplace/demo-listing",
        artifact: "plugin.wasm",
        checksumSha256: "abc",
        downloadUrl: null,
        mirrorUrls: [],
        sizeBytes: null,
      },
      permissions: [],
      capabilities: [],
      tools: [
        {
          toolId: "demo",
          name: "Demo Tool",
          description: "Runs the demo flow.",
          category: "developer",
          uiMode: "text",
        },
      ],
      desktopOnly: true,
      installState: "update-available",
      blockedReason: null,
      compatible: true,
      installedPlugin: null,
      pendingUpdate: {
        pluginId: "com.example.demo",
        currentVersion: "1.0.0",
        latestVersion: "1.2.3",
        downloadUrl: "https://example.invalid",
        changelog: null,
      },
    };

    render(
      <MarketplaceListingCard
        listing={listing}
        busy={true}
        onInstall={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByText("Working...")).toBeInTheDocument();
  });
});

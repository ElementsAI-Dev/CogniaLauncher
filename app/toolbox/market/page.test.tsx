import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ToolboxMarketplacePage from "./page";

const mockReplace = jest.fn();
const mockRefreshCatalog = jest.fn();
const mockInstallListing = jest.fn();
const mockUpdateListing = jest.fn();
const mockClearMarketplaceActionError = jest.fn();
let mockLastActionProgress: {
  kind: "marketplace-install" | "marketplace-update";
  listingId: string;
  pluginId: string;
  phase: "preparing" | "downloading" | "verifying" | "installing" | "completed" | "failed";
  downloadTaskId: string | null;
  toolId: string | null;
  sourceLabel: string | null;
  timestamp: number;
} | null = null;

let mockLastActionError: {
  kind: "marketplace-install" | "marketplace-update";
  category:
    | "compatibility_blocked"
    | "source_unavailable"
    | "validation_failed"
    | "install_execution_failed";
  listingId: string;
  pluginId: string;
  toolId: string | null;
  message: string;
  retryable: boolean;
  timestamp: number;
} | null = null;

const mockListings = [
  {
    id: "hello-world-rust",
    pluginId: "com.cognia.hello-world",
    name: "Hello World",
    description: "Rust example plugin.",
    version: "0.1.0",
    category: "developer",
    featured: true,
    authors: [],
    minimumHostVersion: "0.1.0",
    toolContractVersion: "1.0.0",
    permissions: ["env_read"],
    capabilities: ["environment.read"],
    tools: [
      {
        toolId: "hello",
        name: "Hello",
        description: "Greets",
        category: "developer",
        uiMode: "text",
      },
    ],
    desktopOnly: true,
    source: {
      type: "store" as const,
      storeId: "hello-world-rust",
      pluginDir: "marketplace/hello-world-rust",
      artifact: "plugin.wasm",
      checksumSha256: "abc",
      downloadUrl: null,
      mirrorUrls: [],
      sizeBytes: null,
    },
    installState: "not-installed" as const,
    blockedReason: null,
    compatible: true,
    installedPlugin: null,
    pendingUpdate: null,
  },
];

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/toolbox/market",
  useSearchParams: () => new URLSearchParams(""),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, values?: Record<string, string>) => values?.timestamp ?? key,
  }),
}));

jest.mock("@/components/layout/page-header", () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

jest.mock("@/hooks/toolbox/use-toolbox-marketplace", () => ({
  useToolboxMarketplace: () => ({
    filteredListings: mockListings,
    featuredListings: mockListings,
    recentlyUpdatedListings: mockListings,
    categories: ["developer"],
    catalogSource: "bundled",
    syncState: "ready",
    lastSyncedAt: "2026-03-06T12:00:00.000Z",
    lastError: null,
    lastActionError: mockLastActionError,
    lastActionProgress: mockLastActionProgress,
    refreshCatalog: mockRefreshCatalog,
    getListingById: (listingId: string) =>
      mockListings.find((listing) => listing.id === listingId) ?? null,
    installListing: mockInstallListing,
    updateListing: mockUpdateListing,
    clearMarketplaceActionError: mockClearMarketplaceActionError,
  }),
}));

jest.mock("@/components/toolbox/marketplace-listing-card", () => ({
  MarketplaceListingCard: ({ listing }: { listing: { id: string } }) => (
    <div data-testid={`listing-${listing.id}`} />
  ),
}));

describe("ToolboxMarketplacePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastActionError = null;
    mockLastActionProgress = null;
    mockRefreshCatalog.mockResolvedValue(undefined);
    mockInstallListing.mockResolvedValue("com.cognia.hello-world");
    mockUpdateListing.mockResolvedValue(undefined);
  });

  it("renders listings and refreshes catalog on mount", () => {
    render(<ToolboxMarketplacePage />);

    expect(screen.getByText("toolbox.marketplace.title")).toBeInTheDocument();
    expect(screen.getAllByTestId("listing-hello-world-rust").length).toBeGreaterThan(0);
    expect(mockRefreshCatalog).toHaveBeenCalledTimes(1);
  });

  it("updates query filters through router replace", () => {
    render(<ToolboxMarketplacePage />);

    fireEvent.change(
      screen.getByPlaceholderText("toolbox.marketplace.searchPlaceholder"),
      {
        target: { value: "hello" },
      },
    );

    expect(mockReplace).toHaveBeenCalledWith("/toolbox/market?q=hello");
  });

  it("renders curated sections and source context", () => {
    render(<ToolboxMarketplacePage />);

    expect(screen.getByText("toolbox.marketplace.featuredTitle")).toBeInTheDocument();
    expect(screen.getByText("toolbox.marketplace.recentlyUpdatedTitle")).toBeInTheDocument();
    expect(screen.getByText("toolbox.marketplace.source.bundled")).toBeInTheDocument();
  });

  it("updates sort and verified filters through router replace", () => {
    render(<ToolboxMarketplacePage />);

    fireEvent.change(screen.getByLabelText("toolbox.marketplace.sortLabel"), {
      target: { value: "updated" },
    });
    expect(mockReplace).toHaveBeenCalledWith("/toolbox/market?sort=updated");

    fireEvent.click(screen.getByText("toolbox.marketplace.verifiedOnly"));
    expect(mockReplace).toHaveBeenCalledWith("/toolbox/market?verified=1");
  });

  it("renders actionable failure UI and wires retry/refresh/close actions", async () => {
    mockLastActionError = {
      kind: "marketplace-install",
      category: "source_unavailable",
      listingId: "hello-world-rust",
      pluginId: "com.cognia.hello-world",
      toolId: "plugin:com.cognia.hello-world:hello",
      message: "network timeout",
      retryable: true,
      timestamp: Date.now(),
    };
    render(<ToolboxMarketplacePage />);

    expect(screen.getByText("network timeout")).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.retry"));
    await waitFor(() => {
      expect(mockInstallListing).toHaveBeenCalledWith(mockListings[0]);
    });

    fireEvent.click(screen.getAllByText("toolbox.marketplace.refresh")[0]);
    expect(mockRefreshCatalog).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText("common.close"));
    expect(mockClearMarketplaceActionError).toHaveBeenCalledTimes(1);
  });

  it("renders phase visibility when a marketplace action is in progress", () => {
    mockLastActionProgress = {
      kind: "marketplace-install",
      listingId: "hello-world-rust",
      pluginId: "com.cognia.hello-world",
      phase: "downloading",
      downloadTaskId: "task-123",
      toolId: "plugin:com.cognia.hello-world:hello",
      sourceLabel: "CogniaLauncher Team",
      timestamp: Date.now(),
    };
    render(<ToolboxMarketplacePage />);

    expect(screen.getByText(/Action: marketplace-install/)).toBeInTheDocument();
    expect(screen.getByText(/Phase: downloading/)).toBeInTheDocument();
    expect(screen.getByText(/Source: CogniaLauncher Team/)).toBeInTheDocument();
    expect(
      screen.getByText(/Target: plugin:com.cognia.hello-world:hello/),
    ).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderHistoryTab } from "./provider-history-tab";
import type { InstallHistoryEntry } from "@/types/tauri";

// Polyfill ResizeObserver for JSDOM (ScrollArea)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providerDetail.history": "History",
    "providerDetail.historyDesc": "Installation history",
    "providers.refresh": "Refresh",
    "providerDetail.noHistory": "No history",
    "providerDetail.noHistoryDesc": "No operations have been recorded",
    "providerDetail.searchHistory": "Search history...",
    "providerDetail.action": "Action",
    "providerDetail.packageName": "Package",
    "providerDetail.version": "Version",
    "providerDetail.result": "Result",
    "providerDetail.timestamp": "Time",
    "providerDetail.success": "Success",
    "providerDetail.failed": "Failed",
    "providerDetail.filterByAction": "Filter by action",
    "providerDetail.allActions": "All Actions",
    "providerDetail.filterByResult": "Filter by result",
    "providerDetail.allResults": "All Results",
    "providerDetail.noSearchResults": "No matching results",
    "providerDetail.errorDetails": "Click for details",
  };
  return translations[key] || key;
};

const makeEntry = (overrides: Partial<InstallHistoryEntry> = {}): InstallHistoryEntry => ({
  id: "1",
  name: "lodash",
  version: "4.17.21",
  action: "install",
  timestamp: new Date().toISOString(),
  provider: "npm",
  success: true,
  error_message: null,
  ...overrides,
});

describe("ProviderHistoryTab", () => {
  const defaultProps = {
    installHistory: [] as InstallHistoryEntry[],
    loadingHistory: false,
    onRefreshHistory: jest.fn(() => Promise.resolve([])),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<ProviderHistoryTab {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("shows empty state when no history", () => {
    render(<ProviderHistoryTab {...defaultProps} />);
    expect(screen.getByText("No history")).toBeInTheDocument();
    expect(screen.getByText("No operations have been recorded")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading with no history", () => {
    render(<ProviderHistoryTab {...defaultProps} loadingHistory={true} />);
    expect(screen.queryByText("No history")).not.toBeInTheDocument();
  });

  it("renders history entries in a table", () => {
    const history = [
      makeEntry({ id: "1", name: "lodash", action: "install" }),
      makeEntry({ id: "2", name: "express", action: "uninstall", success: false, error_message: "Permission denied" }),
    ];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("express")).toBeInTheDocument();
    expect(screen.getByText("install")).toBeInTheDocument();
    expect(screen.getByText("uninstall")).toBeInTheDocument();
  });

  it("shows success/failed indicators", () => {
    const history = [
      makeEntry({ id: "1", success: true }),
      makeEntry({ id: "2", name: "express", success: false }),
    ];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows history count badge", () => {
    const history = [makeEntry({ id: "1" }), makeEntry({ id: "2", name: "express" })];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onRefreshHistory when refresh button is clicked", async () => {
    const user = userEvent.setup();
    const history = [makeEntry()];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    const refreshButton = screen.getByText("Refresh").closest("button")!;
    await user.click(refreshButton);
    expect(defaultProps.onRefreshHistory).toHaveBeenCalled();
  });

  it("renders search input when history exists", () => {
    const history = [makeEntry()];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    expect(screen.getByPlaceholderText("Search history...")).toBeInTheDocument();
  });

  it("shows version or dash for entries", () => {
    const history = [
      makeEntry({ id: "1", version: "1.0.0" }),
      makeEntry({ id: "2", name: "other", version: "" }),
    ];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
  });

  it("renders different action types with correct badges", () => {
    const history = [
      makeEntry({ id: "1", action: "install" }),
      makeEntry({ id: "2", name: "pkg2", action: "update" }),
      makeEntry({ id: "3", name: "pkg3", action: "rollback" }),
    ];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    expect(screen.getByText("install")).toBeInTheDocument();
    expect(screen.getByText("update")).toBeInTheDocument();
    expect(screen.getByText("rollback")).toBeInTheDocument();
  });

  it("filters history by search query", async () => {
    const user = userEvent.setup();
    const history = [
      makeEntry({ id: "1", name: "lodash" }),
      makeEntry({ id: "2", name: "express" }),
    ];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} />);
    const searchInput = screen.getByPlaceholderText("Search history...");
    await user.type(searchInput, "lodash");
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.queryByText("express")).not.toBeInTheDocument();
  });

  it("disables refresh button when loading", () => {
    const history = [makeEntry()];
    render(<ProviderHistoryTab {...defaultProps} installHistory={history} loadingHistory={true} />);
    const refreshButton = screen.getByText("Refresh").closest("button")!;
    expect(refreshButton).toBeDisabled();
  });
});

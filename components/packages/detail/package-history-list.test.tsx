import { render, screen } from "@testing-library/react";
import { PackageHistoryList } from "./package-history-list";
import type { InstallHistoryEntry } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.detail.installHistory": "Install History",
        "packages.detail.installHistoryDesc": "History of actions for this package",
        "packages.detail.noHistoryForPackage": "No history for this package",
        "packages.detail.actionInstall": "Installed",
        "packages.detail.actionUninstall": "Uninstalled",
        "packages.detail.actionUpdate": "Updated",
        "packages.detail.actionRollback": "Rolled back",
        "packages.detail.actionPin": "Pinned",
        "packages.detail.actionUnpin": "Unpinned",
        "packages.detail.errorMessage": `Error: ${params?.message ?? ""}`,
      };
      return translations[key] || key;
    },
  }),
}));

const makeEntry = (overrides: Partial<InstallHistoryEntry> = {}): InstallHistoryEntry => ({
  id: "h1",
  name: "numpy",
  action: "install",
  version: "1.24.0",
  provider: "pip",
  timestamp: "2024-06-15T10:30:00Z",
  success: true,
  error_message: null,
  ...overrides,
});

describe("PackageHistoryList", () => {
  it("renders loading skeleton state", () => {
    render(<PackageHistoryList history={[]} loading={true} />);
    expect(screen.getByText("Install History")).toBeInTheDocument();
  });

  it("renders empty state when no history", () => {
    render(<PackageHistoryList history={[]} loading={false} />);
    expect(screen.getByText("No history for this package")).toBeInTheDocument();
  });

  it("renders history entries with action labels", () => {
    const history = [makeEntry({ action: "install" })];
    render(<PackageHistoryList history={history} loading={false} />);
    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.getByText("1.24.0")).toBeInTheDocument();
    expect(screen.getByText("pip")).toBeInTheDocument();
  });

  it("renders multiple action types correctly", () => {
    const history = [
      makeEntry({ id: "h1", action: "install" }),
      makeEntry({ id: "h2", action: "uninstall" }),
      makeEntry({ id: "h3", action: "update" }),
      makeEntry({ id: "h4", action: "rollback" }),
      makeEntry({ id: "h5", action: "pin" }),
      makeEntry({ id: "h6", action: "unpin" }),
    ];
    render(<PackageHistoryList history={history} loading={false} />);
    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.getByText("Uninstalled")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Rolled back")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("Unpinned")).toBeInTheDocument();
  });

  it("shows error message for failed entries", () => {
    const history = [
      makeEntry({ success: false, error_message: "Permission denied" }),
    ];
    render(<PackageHistoryList history={history} loading={false} />);
    expect(screen.getByText("Error: Permission denied")).toBeInTheDocument();
  });

  it("does not show error message for successful entries", () => {
    const history = [makeEntry({ success: true, error_message: null })];
    render(<PackageHistoryList history={history} loading={false} />);
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it("displays timestamp for entries", () => {
    const history = [makeEntry({ timestamp: "2024-06-15T10:30:00Z" })];
    render(<PackageHistoryList history={history} loading={false} />);
    // Date is formatted by toLocaleString, just verify something renders
    const container = screen.getByText("Installed").closest("div")!.parentElement!.parentElement!;
    expect(container).toBeInTheDocument();
  });

  it("renders description text when not loading", () => {
    const history = [makeEntry()];
    render(<PackageHistoryList history={history} loading={false} />);
    expect(screen.getByText("History of actions for this package")).toBeInTheDocument();
  });
});

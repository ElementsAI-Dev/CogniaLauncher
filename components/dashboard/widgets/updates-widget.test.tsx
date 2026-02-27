import { render, screen } from "@testing-library/react";
import { UpdatesWidget } from "./updates-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

let mockAvailableUpdates: Array<{ name: string; provider: string; current_version: string; latest_version: string }> = [];
let mockIsCheckingUpdates = false;
let mockUpdateCheckProgress: { current: number; total: number; phase: string; current_package?: string } | null = null;
let mockLastUpdateCheck: number | null = null;

jest.mock("@/lib/stores/packages", () => ({
  usePackageStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      availableUpdates: mockAvailableUpdates,
      isCheckingUpdates: mockIsCheckingUpdates,
      updateCheckProgress: mockUpdateCheckProgress,
      lastUpdateCheck: mockLastUpdateCheck,
      setIsCheckingUpdates: jest.fn(),
      setAvailableUpdates: jest.fn(),
      setUpdateCheckProgress: jest.fn(),
      setUpdateCheckErrors: jest.fn(),
      setLastUpdateCheck: jest.fn(),
    }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  listenUpdateCheckProgress: jest.fn(() => Promise.resolve(jest.fn())),
  checkUpdates: jest.fn(),
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("UpdatesWidget", () => {
  beforeEach(() => {
    mockAvailableUpdates = [];
    mockIsCheckingUpdates = false;
    mockUpdateCheckProgress = null;
    mockLastUpdateCheck = null;
  });

  it("renders updates title", () => {
    render(<UpdatesWidget />);
    expect(screen.getByText("dashboard.widgets.updatesAvailable")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<UpdatesWidget />);
    expect(screen.getByText("dashboard.widgets.updatesAvailableDesc")).toBeInTheDocument();
  });

  it("shows up-to-date message when no updates and last check exists", () => {
    mockLastUpdateCheck = Date.now();
    render(<UpdatesWidget />);
    expect(screen.getByText("dashboard.widgets.updatesUpToDate")).toBeInTheDocument();
  });

  it("shows update count alert when updates are available", () => {
    mockAvailableUpdates = [
      { name: "typescript", provider: "npm", current_version: "5.0.0", latest_version: "5.3.0" },
    ];
    mockLastUpdateCheck = Date.now();
    render(<UpdatesWidget />);
    expect(screen.getByText("dashboard.widgets.updatesCount")).toBeInTheDocument();
  });

  it("shows update package details", () => {
    mockAvailableUpdates = [
      { name: "typescript", provider: "npm", current_version: "5.0.0", latest_version: "5.3.0" },
    ];
    mockLastUpdateCheck = Date.now();
    render(<UpdatesWidget />);
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("5.0.0")).toBeInTheDocument();
    expect(screen.getByText("5.3.0")).toBeInTheDocument();
  });

  it("shows +N more when more than 5 updates", () => {
    mockAvailableUpdates = Array.from({ length: 7 }, (_, i) => ({
      name: `pkg-${i}`,
      provider: "npm",
      current_version: "1.0.0",
      latest_version: "2.0.0",
    }));
    mockLastUpdateCheck = Date.now();
    render(<UpdatesWidget />);
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });

  it("shows progress bar when checking updates", () => {
    mockIsCheckingUpdates = true;
    mockUpdateCheckProgress = { current: 3, total: 10, phase: "checking", current_package: "typescript" };
    render(<UpdatesWidget />);
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("shows last check time when available", () => {
    mockLastUpdateCheck = Date.now();
    render(<UpdatesWidget />);
    expect(screen.getByText(/dashboard.lastUpdated/)).toBeInTheDocument();
  });

  it("renders view all link", () => {
    render(<UpdatesWidget />);
    expect(screen.getByText("dashboard.packageList.viewAll")).toBeInTheDocument();
  });

  it("has refresh button", () => {
    render(<UpdatesWidget />);
    // First button in CardAction is the refresh button
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("accepts className prop", () => {
    const { container } = render(<UpdatesWidget className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionsCard } from "./actions-card";

jest.mock("@/lib/tauri", () => ({
  openExternal: jest.fn(),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.actions": "Actions",
    "about.actionsDesc": "Quick links and common operations",
    "about.checkForUpdates": "Check for Updates",
    "about.changelog": "Changelog",
    "about.documentation": "Documentation",
    "about.reportBug": "Report Bug",
    "about.featureRequest": "Feature Request",
    "about.exportDiagnostics": "Export Diagnostics",
    "about.updateDesktopOnly": "Desktop only",
    "about.openInNewTab": "opens in new tab",
  };
  return translations[key] || key;
};

const defaultProps = {
  loading: false,
  isDesktop: true,
  onCheckUpdate: jest.fn(),
  onOpenChangelog: jest.fn(),
  onExportDiagnostics: jest.fn(),
  t: mockT,
};

describe("ActionsCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders actions heading", () => {
    render(<ActionsCard {...defaultProps} />);
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders all action buttons", () => {
    render(<ActionsCard {...defaultProps} />);
    expect(screen.getByText("Check for Updates")).toBeInTheDocument();
    expect(screen.getByText("Changelog")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Documentation")).toBeInTheDocument();
    expect(screen.getByText("Report Bug")).toBeInTheDocument();
    expect(screen.getByText("Feature Request")).toBeInTheDocument();
  });

  it("calls onCheckUpdate when Check for Updates is clicked", async () => {
    render(<ActionsCard {...defaultProps} />);
    await userEvent.click(screen.getByText("Check for Updates"));
    expect(defaultProps.onCheckUpdate).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChangelog when Changelog is clicked", async () => {
    render(<ActionsCard {...defaultProps} />);
    await userEvent.click(screen.getByText("Changelog"));
    expect(defaultProps.onOpenChangelog).toHaveBeenCalledTimes(1);
  });

  it("disables Check for Updates button when loading", () => {
    render(<ActionsCard {...defaultProps} loading={true} />);
    expect(screen.getByText("Check for Updates").closest("button")).toBeDisabled();
  });

  it("has correct aria region", () => {
    render(<ActionsCard {...defaultProps} />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("renders Export Diagnostics button", () => {
    render(<ActionsCard {...defaultProps} />);
    expect(screen.getByText("Export Diagnostics")).toBeInTheDocument();
  });

  it("calls onExportDiagnostics when Export Diagnostics is clicked", async () => {
    render(<ActionsCard {...defaultProps} />);
    await userEvent.click(screen.getByText("Export Diagnostics"));
    expect(defaultProps.onExportDiagnostics).toHaveBeenCalledTimes(1);
  });

  it("enables Export Diagnostics in web mode with tooltip hint", () => {
    render(<ActionsCard {...defaultProps} isDesktop={false} />);
    const btn = screen.getByText("Export Diagnostics").closest("button");
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("title");
  });

  it("calls onExportDiagnostics in web mode", async () => {
    render(<ActionsCard {...defaultProps} isDesktop={false} />);
    await userEvent.click(screen.getByText("Export Diagnostics"));
    expect(defaultProps.onExportDiagnostics).toHaveBeenCalledTimes(1);
  });
});

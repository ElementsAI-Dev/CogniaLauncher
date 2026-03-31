import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { writeClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import { VersionCards } from "./version-cards";

jest.mock("@/lib/app-version", () => ({
  APP_VERSION: "0.1.0",
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.versionInfo": "Version Info",
    "about.versionInfoDesc": "Current and latest version status",
    "about.currentVersion": "Current Version",
    "about.latestVersion": "Latest Version",
    "about.upToDate": "Up to date",
    "about.updateAvailable": "Update available",
    "about.updateStatus": "Status",
    "about.errorTitle": "Error",
    "about.copyVersionInfo": "Copy version info",
    "about.versionCopied": "Version copied",
    "about.copyFailed": "Copy failed",
    "common.loading": "Loading",
  };
  return translations[key] || key;
};

const defaultProps = {
  loading: false,
  updateInfo: {
    update_available: false,
    current_version: "1.0.0",
    latest_version: "1.0.0",
    release_notes: null,
  },
  updateStatus: "up_to_date" as const,
  t: mockT,
};

describe("VersionCards", () => {
  it("renders current and latest version labels", () => {
    render(<VersionCards {...defaultProps} />);
    expect(screen.getByText("Current Version")).toBeInTheDocument();
    expect(screen.getByText("Latest Version")).toBeInTheDocument();
  });

  it("renders version values from updateInfo", () => {
    render(<VersionCards {...defaultProps} />);
    expect(screen.getAllByText("v1.0.0")).toHaveLength(2);
  });

  it("shows up to date badge when no update available", () => {
    render(<VersionCards {...defaultProps} />);
    expect(screen.getByText("Up to date")).toBeInTheDocument();
  });

  it("shows update available when update exists", () => {
    render(
      <VersionCards
        {...defaultProps}
        updateInfo={{
          update_available: true,
          current_version: "1.0.0",
          latest_version: "1.1.0",
          release_notes: null,
        }}
        updateStatus="update_available"
      />,
    );
    expect(screen.getByText("Update available")).toBeInTheDocument();
  });

  it("does not show up-to-date badge when check has source diagnostics", () => {
    render(
      <VersionCards
        {...defaultProps}
        updateInfo={{
          update_available: false,
          current_version: "1.0.0",
          latest_version: "1.0.0",
          release_notes: null,
          error_category: "source_unavailable",
          error_message: "mirror unavailable",
        }}
        updateStatus="error"
      />,
    );
    expect(screen.queryByText("Up to date")).not.toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    const { container } = render(
      <VersionCards {...defaultProps} loading={true} />,
    );
    expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("falls back to APP_VERSION when updateInfo is null", () => {
    render(<VersionCards {...defaultProps} updateInfo={null} updateStatus="idle" />);
    expect(screen.getAllByText("v0.1.0")).toHaveLength(2);
  });

  it("has correct aria group role", () => {
    render(<VersionCards {...defaultProps} />);
    expect(screen.getByRole("group")).toBeInTheDocument();
  });

  it("copies version info on click", async () => {
    render(<VersionCards {...defaultProps} />);
    const copyButton = screen.getByLabelText("Copy version info");
    await userEvent.click(copyButton);
    expect(writeClipboard).toHaveBeenCalledWith("CogniaLauncher v1.0.0");
    expect(toast.success).toHaveBeenCalledWith("Version copied");
  });
});

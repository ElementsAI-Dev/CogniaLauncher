import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CleanupDialog } from "./cleanup-dialog";
import type { InstalledVersion } from "@/lib/tauri";

jest.mock("@/lib/utils", () => ({
  formatSize: (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const t = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    "environments.cleanup.title": "Clean Up Old Versions",
    "environments.cleanup.description": `Remove unused versions of ${params?.envType ?? ""} to free disk space`,
    "environments.cleanup.selectAll": "Select All Removable",
    "environments.cleanup.clearSelection": "Clear Selection",
    "environments.cleanup.willFree": `Will free ${params?.size ?? ""}`,
    "environments.cleanup.noVersions": "No versions installed",
    "environments.cleanup.totalInstalled": `${params?.count ?? 0} version(s) installed`,
    "environments.cleanup.cleanSelected": `Remove ${params?.count ?? 0} version(s)`,
    "environments.cleanup.removed": `Removed ${params?.count ?? 0} version(s), freed ${params?.size ?? ""}`,
    "environments.currentVersion": "Current",
    "common.close": "Close",
  };
  return translations[key] || key;
};

const makeVersions = (): InstalledVersion[] => [
  { version: "22.0.0", install_path: "/node/22", size: 104857600, installed_at: "2024-04-01T00:00:00Z", is_current: true },
  { version: "20.10.0", install_path: "/node/20", size: 94371840, installed_at: "2023-11-01T00:00:00Z", is_current: false },
  { version: "18.19.0", install_path: "/node/18", size: 83886080, installed_at: "2023-06-01T00:00:00Z", is_current: false },
];

describe("CleanupDialog", () => {
  it("renders title and description", () => {
    render(
      <CleanupDialog
        envType="node"
        installedVersions={makeVersions()}
        currentVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        onCleanup={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("Clean Up Old Versions")).toBeInTheDocument();
  });

  it("shows all installed versions", () => {
    render(
      <CleanupDialog
        envType="node"
        installedVersions={makeVersions()}
        currentVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        onCleanup={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("22.0.0")).toBeInTheDocument();
    expect(screen.getByText("20.10.0")).toBeInTheDocument();
    expect(screen.getByText("18.19.0")).toBeInTheDocument();
  });

  it("marks current version with badge", () => {
    render(
      <CleanupDialog
        envType="node"
        installedVersions={makeVersions()}
        currentVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        onCleanup={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("disables checkbox for current version", () => {
    render(
      <CleanupDialog
        envType="node"
        installedVersions={makeVersions()}
        currentVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        onCleanup={jest.fn()}
        t={t}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox (22.0.0 current) should be disabled
    expect(checkboxes[0]).toBeDisabled();
    // Others should be enabled
    expect(checkboxes[1]).not.toBeDisabled();
    expect(checkboxes[2]).not.toBeDisabled();
  });

  it("select all selects only removable versions", async () => {
    const user = userEvent.setup();
    render(
      <CleanupDialog
        envType="node"
        installedVersions={makeVersions()}
        currentVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        onCleanup={jest.fn()}
        t={t}
      />,
    );
    await user.click(screen.getByText("Select All Removable"));
    // Should show "Remove 2 version(s)" button (not 3, since current is excluded)
    expect(screen.getByText("Remove 2 version(s)")).toBeInTheDocument();
  });

  it("calls onCleanup with selected versions", async () => {
    const user = userEvent.setup();
    const onCleanup = jest.fn().mockResolvedValue({
      removed: [{ version: "18.19.0", size: 83886080 }],
      freedBytes: 83886080,
      errors: [],
    });
    render(
      <CleanupDialog
        envType="node"
        installedVersions={makeVersions()}
        currentVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        onCleanup={onCleanup}
        t={t}
      />,
    );
    // Click 18.19.0 checkbox (3rd checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[2]);
    await user.click(screen.getByText("Remove 1 version(s)"));
    expect(onCleanup).toHaveBeenCalledWith(["18.19.0"]);
  });

  it("shows empty state when no versions installed", () => {
    render(
      <CleanupDialog
        envType="node"
        installedVersions={[]}
        currentVersion={null}
        open={true}
        onOpenChange={jest.fn()}
        onCleanup={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("No versions installed")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <CleanupDialog
        envType="node"
        installedVersions={makeVersions()}
        currentVersion="22.0.0"
        open={false}
        onOpenChange={jest.fn()}
        onCleanup={jest.fn()}
        t={t}
      />,
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });
});

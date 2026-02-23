import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MigratePackagesDialog } from "./migrate-packages-dialog";

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => true),
  envListGlobalPackages: jest.fn(),
  envMigratePackages: jest.fn(),
  listenEnvMigrateProgress: jest.fn().mockResolvedValue(jest.fn()),
}));

jest.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const mockTauri = jest.requireMock("@/lib/tauri");

const t = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    "environments.migrate.title": "Migrate Global Packages",
    "environments.migrate.loadingPackages": "Loading global packages...",
    "environments.migrate.noPackages": "No global packages found",
    "environments.migrate.packagesFound": `${params?.count ?? 0} global package(s) found`,
    "environments.migrate.migrateSelected": `Migrate ${params?.count ?? 0} package(s)`,
    "common.selected": "selected",
    "common.cancel": "Cancel",
    "common.close": "Close",
  };
  return translations[key] || key;
};

describe("MigratePackagesDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title with version badges", async () => {
    mockTauri.envListGlobalPackages.mockResolvedValue([]);

    render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );

    expect(screen.getByText("Migrate Global Packages")).toBeInTheDocument();
    expect(screen.getByText("20.10.0")).toBeInTheDocument();
    expect(screen.getByText("22.0.0")).toBeInTheDocument();
  });

  it("shows loading state while fetching packages", () => {
    mockTauri.envListGlobalPackages.mockReturnValue(new Promise(() => {}));

    render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );

    expect(screen.getByText("Loading global packages...")).toBeInTheDocument();
  });

  it("shows empty state when no packages found", async () => {
    mockTauri.envListGlobalPackages.mockResolvedValue([]);

    render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No global packages found")).toBeInTheDocument();
    });
  });

  it("shows packages with checkboxes when found", async () => {
    mockTauri.envListGlobalPackages.mockResolvedValue([
      { name: "typescript", version: "5.3.3" },
      { name: "eslint", version: "8.56.0" },
    ]);

    render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("typescript")).toBeInTheDocument();
      expect(screen.getByText("eslint")).toBeInTheDocument();
      expect(screen.getByText("5.3.3")).toBeInTheDocument();
      expect(screen.getByText("8.56.0")).toBeInTheDocument();
    });
  });

  it("all packages selected by default", async () => {
    mockTauri.envListGlobalPackages.mockResolvedValue([
      { name: "typescript", version: "5.3.3" },
      { name: "eslint", version: "8.56.0" },
    ]);

    render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });
  });

  it("toggles package selection", async () => {
    const user = userEvent.setup();
    mockTauri.envListGlobalPackages.mockResolvedValue([
      { name: "typescript", version: "5.3.3" },
      { name: "eslint", version: "8.56.0" },
    ]);

    render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("typescript")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("calls migrate with selected packages", async () => {
    const user = userEvent.setup();
    mockTauri.envListGlobalPackages.mockResolvedValue([
      { name: "typescript", version: "5.3.3" },
    ]);
    mockTauri.envMigratePackages.mockResolvedValue({
      migrated: ["typescript"],
      failed: [],
      skipped: [],
    });

    render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={true}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("typescript")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Migrate 1 package(s)"));

    await waitFor(() => {
      expect(mockTauri.envMigratePackages).toHaveBeenCalledWith(
        "node",
        "20.10.0",
        "22.0.0",
        ["typescript"],
      );
    });
  });

  it("does not render when closed", () => {
    const { container } = render(
      <MigratePackagesDialog
        envType="node"
        fromVersion="20.10.0"
        toVersion="22.0.0"
        open={false}
        onOpenChange={jest.fn()}
        t={t}
      />,
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });
});

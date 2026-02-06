import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VersionBrowserPanel } from "./version-browser-panel";
import { useEnvironmentStore } from "@/lib/stores/environment";
import { toast } from "sonner";

jest.mock("@/lib/tauri", () => ({
  envAvailableVersions: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/stores/environment", () => ({
  useEnvironmentStore: jest.fn(),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "common.install") return "Install";
      if (key === "common.uninstall") return "Uninstall";
      if (key === "common.clear") return "Clear";
      if (key === "environments.batchInstallSuccess") {
        return `batchInstallSuccess:${params?.count}`;
      }
      if (key === "environments.batchInstallError") {
        return `batchInstallError:${params?.count}`;
      }
      if (key === "environments.batchUninstallSuccess") {
        return `batchUninstallSuccess:${params?.count}`;
      }
      if (key === "environments.batchUninstallError") {
        return `batchUninstallError:${params?.count}`;
      }
      return key;
    },
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUseEnvironmentStore = useEnvironmentStore as unknown as jest.Mock;

describe("VersionBrowserPanel batch operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles partial batch install and keeps failed selections", async () => {
    const toggleVersionSelection = jest.fn();
    const clearVersionSelection = jest.fn();

    mockUseEnvironmentStore.mockReturnValue({
      availableVersions: {
        node: [
          {
            version: "18.0.0",
            release_date: null,
            deprecated: false,
            yanked: false,
          },
          {
            version: "20.0.0",
            release_date: null,
            deprecated: false,
            yanked: false,
          },
        ],
      },
      setAvailableVersions: jest.fn(),
      selectedVersions: [
        { envType: "node", version: "18.0.0" },
        { envType: "node", version: "20.0.0" },
      ],
      toggleVersionSelection,
      clearVersionSelection,
    });

    const onInstall = jest.fn(async (version: string) => {
      if (version === "18.0.0") {
        return;
      }
      throw new Error("fail");
    });

    render(
      <VersionBrowserPanel
        envType="node"
        open
        onOpenChange={() => undefined}
        onInstall={onInstall}
        installedVersions={[]}
        providerId="fnm"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Install (2)" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("batchInstallSuccess:1");
      expect(toast.error).toHaveBeenCalledWith("batchInstallError:1");
    });

    expect(clearVersionSelection).not.toHaveBeenCalled();
    expect(toggleVersionSelection).toHaveBeenCalledWith("node", "18.0.0");
  });

  it("handles partial batch uninstall and keeps failed selections", async () => {
    const toggleVersionSelection = jest.fn();
    const clearVersionSelection = jest.fn();

    mockUseEnvironmentStore.mockReturnValue({
      availableVersions: {
        node: [
          {
            version: "18.0.0",
            release_date: null,
            deprecated: false,
            yanked: false,
          },
          {
            version: "20.0.0",
            release_date: null,
            deprecated: false,
            yanked: false,
          },
        ],
      },
      setAvailableVersions: jest.fn(),
      selectedVersions: [
        { envType: "node", version: "18.0.0" },
        { envType: "node", version: "20.0.0" },
      ],
      toggleVersionSelection,
      clearVersionSelection,
    });

    const onUninstall = jest.fn(async (version: string) => {
      if (version === "18.0.0") {
        return;
      }
      throw new Error("fail");
    });

    render(
      <VersionBrowserPanel
        envType="node"
        open
        onOpenChange={() => undefined}
        onInstall={jest.fn()}
        onUninstall={onUninstall}
        installedVersions={["18.0.0", "20.0.0"]}
        providerId="fnm"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Uninstall (2)" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("batchUninstallSuccess:1");
      expect(toast.error).toHaveBeenCalledWith("batchUninstallError:1");
    });

    expect(clearVersionSelection).not.toHaveBeenCalled();
    expect(toggleVersionSelection).toHaveBeenCalledWith("node", "18.0.0");
  });
});

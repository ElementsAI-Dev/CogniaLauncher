import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvDetailShims } from "./env-detail-shims";

const mockFetchShims = jest.fn();
const mockCreateShim = jest.fn();
const mockRemoveShim = jest.fn();
const mockRegenerateAll = jest.fn();
const mockFetchPathStatus = jest.fn();
const mockSetupPath = jest.fn();
const mockGetAddCommand = jest.fn();

let mockShimState = {
  shims: [] as Array<{ binaryName: string; envType: string; version: string | null; targetPath: string }>,
  pathStatus: null as { isInPath: boolean; shimDir: string } | null,
  loading: false,
  error: null as string | null,
};

jest.mock("@/hooks/use-shim", () => ({
  useShim: () => ({
    ...mockShimState,
    fetchShims: mockFetchShims,
    createShim: mockCreateShim,
    removeShim: mockRemoveShim,
    regenerateAll: mockRegenerateAll,
    fetchPathStatus: mockFetchPathStatus,
    setupPath: mockSetupPath,
    getAddCommand: mockGetAddCommand,
  }),
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

let mockIsTauriValue = true;
jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauriValue,
}));

describe("EnvDetailShims", () => {
  const mockT = (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      "environments.shims.desktopOnly": "Desktop App Required",
      "environments.shims.pathStatusTitle": "PATH Status",
      "environments.shims.pathStatusDesc": "Check if shim directory is in your PATH",
      "environments.shims.pathConfigured": "PATH is configured",
      "environments.shims.pathNotConfigured": "PATH is not configured",
      "environments.shims.addToPath": "Add to PATH",
      "environments.shims.copyCommand": "Copy Command",
      "environments.shims.title": "Shims",
      "environments.shims.description": "Manage binary shims",
      "environments.shims.noShims": "No shims found",
      "environments.shims.regenerateAll": "Regenerate All",
      "environments.shims.createNew": "Create New Shim",
      "environments.shims.binaryNamePlaceholder": "Binary name",
      "environments.shims.versionPlaceholder": "Version",
      "environments.shims.targetPathPlaceholder": "Target path",
      "environments.shims.created": `Created shim ${params?.name || ""}`,
      "environments.shims.removed": `Removed shim ${params?.name || ""}`,
      "environments.shims.regenerated": "All shims regenerated",
      "environments.shims.pathAdded": "Added to PATH",
      "environments.shims.deleteConfirm": `Delete ${params?.name || ""}?`,
      "environments.refresh": "Refresh",
      "common.loading": "Loading...",
      "common.confirm": "Confirm",
      "common.cancel": "Cancel",
      "common.delete": "Delete",
      "common.add": "Add",
      "common.copied": "Copied",
      "common.copyFailed": "Copy failed",
    };
    return translations[key] || key;
  };

  const defaultProps = {
    envType: "node",
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauriValue = true;
    mockShimState = {
      shims: [],
      pathStatus: null,
      loading: false,
      error: null,
    };
  });

  it("shows desktop-only message when not in Tauri", () => {
    mockIsTauriValue = false;
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("Desktop App Required")).toBeInTheDocument();
  });

  it("renders PATH status section", () => {
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("PATH Status")).toBeInTheDocument();
  });

  it("shows loading state when path status is null", () => {
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows PATH configured when isInPath is true", () => {
    mockShimState.pathStatus = { isInPath: true, shimDir: "/usr/local/bin" };
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("PATH is configured")).toBeInTheDocument();
    expect(screen.getByText("/usr/local/bin")).toBeInTheDocument();
  });

  it("shows PATH not configured with action buttons", () => {
    mockShimState.pathStatus = { isInPath: false, shimDir: "/home/user/.shims" };
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("PATH is not configured")).toBeInTheDocument();
    expect(screen.getByText("Add to PATH")).toBeInTheDocument();
    expect(screen.getByText("Copy Command")).toBeInTheDocument();
  });

  it("renders shim list section", () => {
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("Shims")).toBeInTheDocument();
    expect(screen.getByText("Manage binary shims")).toBeInTheDocument();
  });

  it("shows empty state when no shims", () => {
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("No shims found")).toBeInTheDocument();
  });

  it("renders shims when available", () => {
    mockShimState.shims = [
      { binaryName: "npx", envType: "node", version: "18.0.0", targetPath: "/usr/local/bin/npx" },
    ];
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("npx")).toBeInTheDocument();
    expect(screen.getByText("18.0.0")).toBeInTheDocument();
    expect(screen.getByText("/usr/local/bin/npx")).toBeInTheDocument();
  });

  it("renders create new shim form", () => {
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("Create New Shim")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Binary name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Version")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Target path")).toBeInTheDocument();
  });

  it("disables add button when required fields are empty", () => {
    render(<EnvDetailShims {...defaultProps} />);
    const addBtn = screen.getByText("Add").closest("button");
    expect(addBtn).toBeDisabled();
  });

  it("renders refresh and regenerate buttons", () => {
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Regenerate All")).toBeInTheDocument();
  });

  it("calls regenerateAll when regenerate button is clicked", async () => {
    mockRegenerateAll.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<EnvDetailShims {...defaultProps} />);
    await user.click(screen.getByText("Regenerate All"));

    await waitFor(() => {
      expect(mockRegenerateAll).toHaveBeenCalled();
    });
  });

  it("shows error message when error exists", () => {
    mockShimState.error = "Failed to fetch shims";
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.getByText("Failed to fetch shims")).toBeInTheDocument();
  });

  it("calls setupPath when Add to PATH is clicked", async () => {
    mockShimState.pathStatus = { isInPath: false, shimDir: "/home/user/.shims" };
    mockSetupPath.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<EnvDetailShims {...defaultProps} />);
    await user.click(screen.getByText("Add to PATH"));

    await waitFor(() => {
      expect(mockSetupPath).toHaveBeenCalled();
    });
  });

  it("calls getAddCommand when Copy Command is clicked", async () => {
    mockShimState.pathStatus = { isInPath: false, shimDir: "/home/user/.shims" };
    mockGetAddCommand.mockResolvedValue("export PATH=$PATH:/home/user/.shims");
    const user = userEvent.setup();
    render(<EnvDetailShims {...defaultProps} />);
    await user.click(screen.getByText("Copy Command"));

    await waitFor(() => {
      expect(mockGetAddCommand).toHaveBeenCalled();
    });
  });

  it("calls createShim when form is submitted", async () => {
    mockCreateShim.mockResolvedValue("/home/user/.shims/mybin");
    const user = userEvent.setup();
    render(<EnvDetailShims {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Binary name"), "mybin");
    await user.type(screen.getByPlaceholderText("Target path"), "/usr/bin/mybin");
    await user.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(mockCreateShim).toHaveBeenCalledWith("mybin", "node", null, "/usr/bin/mybin");
    });
  });

  it("calls createShim with version when provided", async () => {
    mockCreateShim.mockResolvedValue("/home/user/.shims/mybin");
    const user = userEvent.setup();
    render(<EnvDetailShims {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Binary name"), "mybin");
    await user.type(screen.getByPlaceholderText("Version"), "18.0.0");
    await user.type(screen.getByPlaceholderText("Target path"), "/usr/bin/mybin");
    await user.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(mockCreateShim).toHaveBeenCalledWith("mybin", "node", "18.0.0", "/usr/bin/mybin");
    });
  });

  it("calls fetchShims when refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<EnvDetailShims {...defaultProps} />);
    await user.click(screen.getByText("Refresh"));

    expect(mockFetchShims).toHaveBeenCalled();
  });

  it("hides Add to PATH buttons when path is already configured", () => {
    mockShimState.pathStatus = { isInPath: true, shimDir: "/usr/local/bin" };
    render(<EnvDetailShims {...defaultProps} />);
    expect(screen.queryByText("Add to PATH")).toBeNull();
    expect(screen.queryByText("Copy Command")).toBeNull();
  });
});

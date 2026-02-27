import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroFilesystem } from "./wsl-distro-filesystem";
import type { WslExecResult } from "@/types/tauri";

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(() => Promise.resolve()),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "wsl.detail.filesystem": "Filesystem",
    "wsl.detail.refresh": "Refresh",
    "wsl.detail.browse": "Browse",
    "wsl.detail.emptyDir": "Directory is empty",
    "wsl.detail.filesystemHint": "Click Browse to explore the filesystem",
    "wsl.detail.fileName": "Name",
    "wsl.detail.filePermissions": "Permissions",
    "wsl.detail.fileSize": "Size",
    "wsl.detail.fileModified": "Modified",
    "common.copy": "Copy",
    "common.copied": "Copied",
  };
  return translations[key] || key;
};

const lsOutput = [
  "total 24",
  "drwxr-xr-x  3 root root 4096 Jan 10 12:00 etc",
  "-rw-r--r--  1 root root  220 Jan 10 12:00 .bashrc",
  "lrwxrwxrwx  1 root root    7 Jan 10 12:00 lib -> usr/lib",
].join("\n");

describe("WslDistroFilesystem", () => {
  const defaultProps = {
    distroName: "Ubuntu",
    onExec: jest.fn<Promise<WslExecResult>, [string, string, string?]>(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.onExec.mockResolvedValue({ exitCode: 0, stdout: lsOutput, stderr: "" });
  });

  it("renders title and initial hint", () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    expect(screen.getByText("Filesystem")).toBeInTheDocument();
    expect(screen.getByText("Click Browse to explore the filesystem")).toBeInTheDocument();
  });

  it("shows Browse button before first load", () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    expect(screen.getByText("Browse")).toBeInTheDocument();
  });

  it("loads directory on Browse click", async () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(defaultProps.onExec).toHaveBeenCalledWith(
        "Ubuntu",
        expect.stringContaining("ls -la"),
      );
    });
  });

  it("displays file entries after successful load", async () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByText("etc")).toBeInTheDocument();
      expect(screen.getByText(".bashrc")).toBeInTheDocument();
    });
  });

  it("displays symlink with target", async () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByText("lib")).toBeInTheDocument();
      expect(screen.getByText(/usr\/lib/)).toBeInTheDocument();
    });
  });

  it("shows error alert when exec fails", async () => {
    defaultProps.onExec.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "Permission denied",
    });
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });

  it("shows empty directory message", async () => {
    defaultProps.onExec.mockResolvedValue({
      exitCode: 0,
      stdout: "total 0",
      stderr: "",
    });
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByText("Directory is empty")).toBeInTheDocument();
    });
  });

  it("navigates into directory on click", async () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByText("etc")).toBeInTheDocument();
    });
    // Click directory "etc"
    await userEvent.click(screen.getByText("etc"));
    await waitFor(() => {
      // Should call onExec for the new path
      expect(defaultProps.onExec).toHaveBeenCalledWith(
        "Ubuntu",
        expect.stringContaining("/etc"),
      );
    });
  });

  it("home button navigates to root", async () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByText("etc")).toBeInTheDocument();
    });
    // Click Home button
    const homeBtn = screen.getByTitle("Home");
    await userEvent.click(homeBtn);
    expect(defaultProps.onExec).toHaveBeenCalledWith(
      "Ubuntu",
      expect.stringContaining('"/"'),
    );
  });

  it("changes to Refresh button after first load", async () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    expect(screen.getByText("Browse")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });

  it("up button is disabled at root", () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    const upBtn = screen.getByTitle("Up");
    expect(upBtn).toBeDisabled();
  });

  it("handles exception from onExec gracefully", async () => {
    defaultProps.onExec.mockRejectedValue(new Error("Connection lost"));
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      // String(new Error("...")) produces "Error: Connection lost"
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
    });
  });

  it("sorts directories before files", async () => {
    render(<WslDistroFilesystem {...defaultProps} />);
    await userEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      // First data row should be the directory "etc"
      expect(rows[1]).toHaveTextContent("etc");
    });
  });
});

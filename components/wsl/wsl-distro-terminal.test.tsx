import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroTerminal } from "./wsl-distro-terminal";
import type { WslExecResult } from "@/types/tauri";

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(() => Promise.resolve()),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "wsl.detail.terminal": "Terminal",
    "wsl.detail.terminalEmpty": "No commands executed yet",
    "wsl.exec.user": "User",
    "wsl.exec.commandPlaceholder": "Enter command...",
    "wsl.exec.run": "Run",
    "wsl.exec.noRunningHint": "Distro is not running",
    "wsl.running": "Running",
    "common.clear": "Clear",
    "common.copy": "Copy",
    "common.copied": "Copied",
  };
  return translations[key] || key;
};

describe("WslDistroTerminal", () => {
  const mockExec = jest.fn<Promise<WslExecResult>, [string, string, string?]>();

  const defaultProps = {
    distroName: "Ubuntu",
    isRunning: true,
    onExec: mockExec,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue({ exitCode: 0, stdout: "hello world", stderr: "" });
  });

  it("renders title with distro name", () => {
    render(<WslDistroTerminal {...defaultProps} />);
    expect(screen.getByText(/Terminal — Ubuntu/)).toBeInTheDocument();
  });

  it("shows Running badge when isRunning is true", () => {
    render(<WslDistroTerminal {...defaultProps} />);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("does not show Running badge when isRunning is false", () => {
    render(<WslDistroTerminal {...defaultProps} isRunning={false} />);
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("shows not running hint when isRunning is false", () => {
    render(<WslDistroTerminal {...defaultProps} isRunning={false} />);
    expect(screen.getByText("Distro is not running")).toBeInTheDocument();
  });

  it("renders command input and Run button", () => {
    render(<WslDistroTerminal {...defaultProps} />);
    expect(screen.getByPlaceholderText("Enter command...")).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("disables Run button when command is empty", () => {
    render(<WslDistroTerminal {...defaultProps} />);
    expect(screen.getByText("Run").closest("button")).toBeDisabled();
  });

  it("shows empty terminal message initially", () => {
    render(<WslDistroTerminal {...defaultProps} />);
    expect(screen.getByText("No commands executed yet")).toBeInTheDocument();
  });

  it("executes command and shows output", async () => {
    render(<WslDistroTerminal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Enter command...");
    await userEvent.type(input, "echo hello");
    await userEvent.click(screen.getByText("Run"));
    expect(mockExec).toHaveBeenCalledWith("Ubuntu", "echo hello", undefined);
    await waitFor(() => {
      expect(screen.getByText("hello world")).toBeInTheDocument();
    });
  });

  it("shows stderr output for failed commands", async () => {
    mockExec.mockResolvedValue({ exitCode: 127, stdout: "", stderr: "command not found" });
    render(<WslDistroTerminal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Enter command...");
    await userEvent.type(input, "badcmd");
    await userEvent.click(screen.getByText("Run"));
    await waitFor(() => {
      expect(screen.getByText("command not found")).toBeInTheDocument();
    });
  });

  it("clears command input after execution", async () => {
    render(<WslDistroTerminal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Enter command...") as HTMLInputElement;
    await userEvent.type(input, "echo hello");
    await userEvent.click(screen.getByText("Run"));
    await waitFor(() => {
      expect(screen.getByText("hello world")).toBeInTheDocument();
    });
    expect(input.value).toBe("");
  });

  it("shows Clear button after execution and clears history", async () => {
    render(<WslDistroTerminal {...defaultProps} />);
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText("Enter command...");
    await userEvent.type(input, "echo hello");
    await userEvent.click(screen.getByText("Run"));
    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("hello world")).not.toBeInTheDocument();
    expect(screen.getByText("No commands executed yet")).toBeInTheDocument();
  });

  it("executes command on Enter key", async () => {
    render(<WslDistroTerminal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Enter command...");
    await userEvent.type(input, "pwd{enter}");
    expect(mockExec).toHaveBeenCalledWith("Ubuntu", "pwd", undefined);
  });

  it("passes user field to onExec", async () => {
    render(<WslDistroTerminal {...defaultProps} />);
    const userInput = screen.getByPlaceholderText("root");
    await userEvent.type(userInput, "alice");
    const cmdInput = screen.getByPlaceholderText("Enter command...");
    await userEvent.type(cmdInput, "whoami");
    await userEvent.click(screen.getByText("Run"));
    expect(mockExec).toHaveBeenCalledWith("Ubuntu", "whoami", "alice");
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShellInitStep } from "./shell-init-step";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(),
}));

jest.mock("@/lib/platform", () => ({
  isWindows: () => true,
}));

const mockPathCheck = jest.fn();
const mockPathSetup = jest.fn();

jest.mock("@/lib/tauri", () => ({
  isTauri: () => true,
  pathCheck: (...args: unknown[]) => mockPathCheck(...args),
  pathSetup: (...args: unknown[]) => mockPathSetup(...args),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.shellTitle": "Shell Integration",
    "onboarding.shellDesc": "Add CogniaLauncher to your PATH",
    "onboarding.shellAutoSetup": "Auto Setup PATH",
    "onboarding.shellAutoSetupSuccess": "PATH configured!",
    "onboarding.shellAutoSetupFailed": "Auto setup failed",
    "onboarding.shellAlreadyConfigured": "PATH already configured",
    "onboarding.shellCopy": "Copy",
    "onboarding.shellCopied": "Copied!",
    "onboarding.shellCopyFailed": "Copy failed",
    "onboarding.shellHint": "You can do this later in settings",
    "onboarding.shellDetailedWhereTitle": "Where to paste this",
    "onboarding.shellDetailedWhereDesc": "Open the config file and paste the snippet.",
    "onboarding.shellDetailedVerifyTitle": "How to verify it",
    "onboarding.shellDetailedVerifyDesc": "Restart the terminal and run a familiar tool command.",
  };
  return translations[key] || key;
};

describe("ShellInitStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathCheck.mockResolvedValue(false);
  });

  it("renders title", () => {
    render(<ShellInitStep t={mockT} />);
    expect(screen.getByText("Shell Integration")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<ShellInitStep t={mockT} />);
    expect(screen.getByText("Add CogniaLauncher to your PATH")).toBeInTheDocument();
  });

  it("renders shell selector buttons", () => {
    render(<ShellInitStep t={mockT} />);
    expect(screen.getByText("PowerShell")).toBeInTheDocument();
    expect(screen.getByText("Bash")).toBeInTheDocument();
    expect(screen.getByText("Zsh")).toBeInTheDocument();
    expect(screen.getByText("Fish")).toBeInTheDocument();
  });

  it("shows command for selected shell", async () => {
    render(<ShellInitStep t={mockT} />);
    await userEvent.click(screen.getByText("Fish"));
    expect(screen.getByText(/fish_add_path/)).toBeInTheDocument();
  });

  it("renders copy button", () => {
    render(<ShellInitStep t={mockT} />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("renders hint text", () => {
    render(<ShellInitStep t={mockT} />);
    expect(screen.getByText("You can do this later in settings")).toBeInTheDocument();
  });

  it("shows success toast after successful copy", async () => {
    const { writeClipboard } = jest.requireMock("@/lib/clipboard");
    const { toast } = jest.requireMock("sonner");
    (writeClipboard as jest.Mock).mockResolvedValueOnce(undefined);

    render(<ShellInitStep t={mockT} />);
    await userEvent.click(screen.getByText("Copy"));

    expect(writeClipboard).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Copied!");
  });

  it("shows error toast when copy fails", async () => {
    const { writeClipboard } = jest.requireMock("@/lib/clipboard");
    const { toast } = jest.requireMock("sonner");
    (writeClipboard as jest.Mock).mockRejectedValueOnce(new Error("fail"));

    render(<ShellInitStep t={mockT} />);
    await userEvent.click(screen.getByText("Copy"));

    expect(toast.error).toHaveBeenCalledWith("Copy failed");
  });

  it("resets copied state when switching shell", async () => {
    const { writeClipboard } = jest.requireMock("@/lib/clipboard");
    (writeClipboard as jest.Mock).mockResolvedValue(undefined);

    render(<ShellInitStep t={mockT} />);
    await userEvent.click(screen.getByText("Copy"));
    await userEvent.click(screen.getByText("Bash"));
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("shows PowerShell command by default on Windows", () => {
    render(<ShellInitStep t={mockT} />);
    expect(screen.getByText("$PROFILE")).toBeInTheDocument();
    expect(screen.getByText(/\$env:PATH/)).toBeInTheDocument();
  });

  it("renders Auto Setup button in Tauri mode", async () => {
    render(<ShellInitStep t={mockT} />);
    await waitFor(() => {
      expect(screen.getByText("Auto Setup PATH")).toBeInTheDocument();
    });
  });

  it("shows already configured message when PATH is set", async () => {
    mockPathCheck.mockResolvedValue(true);
    render(<ShellInitStep t={mockT} />);
    await waitFor(() => {
      expect(screen.getByText("PATH already configured")).toBeInTheDocument();
    });
  });

  it("calls pathSetup when Auto Setup button is clicked", async () => {
    mockPathSetup.mockResolvedValue(undefined);
    render(<ShellInitStep t={mockT} />);
    await waitFor(() => {
      expect(screen.getByText("Auto Setup PATH")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Auto Setup PATH"));
    await waitFor(() => {
      expect(mockPathSetup).toHaveBeenCalled();
    });
  });

  it("shows success toast after successful auto setup", async () => {
    const { toast } = jest.requireMock("sonner");
    mockPathSetup.mockResolvedValue(undefined);
    render(<ShellInitStep t={mockT} />);
    await waitFor(() => {
      expect(screen.getByText("Auto Setup PATH")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Auto Setup PATH"));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("PATH configured!");
    });
  });

  it("shows error toast when auto setup fails", async () => {
    const { toast } = jest.requireMock("sonner");
    mockPathSetup.mockRejectedValue(new Error("fail"));
    render(<ShellInitStep t={mockT} />);
    await waitFor(() => {
      expect(screen.getByText("Auto Setup PATH")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Auto Setup PATH"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Auto setup failed");
    });
  });

  it("shows extra follow-up guidance in detailed mode", () => {
    render(<ShellInitStep t={mockT} mode="detailed" />);
    expect(screen.getByText("Where to paste this")).toBeInTheDocument();
    expect(screen.getByText("Open the config file and paste the snippet.")).toBeInTheDocument();
    expect(screen.getByText("How to verify it")).toBeInTheDocument();
    expect(screen.getByText("Restart the terminal and run a familiar tool command.")).toBeInTheDocument();
  });
});

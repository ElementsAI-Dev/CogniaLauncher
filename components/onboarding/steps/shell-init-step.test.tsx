import { render, screen } from "@testing-library/react";
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

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.shellTitle": "Shell Integration",
    "onboarding.shellDesc": "Add CogniaLauncher to your PATH",
    "onboarding.shellCopy": "Copy",
    "onboarding.shellCopied": "Copied!",
    "onboarding.shellCopyFailed": "Copy failed",
    "onboarding.shellHint": "You can do this later in settings",
  };
  return translations[key] || key;
};

describe("ShellInitStep", () => {
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
    // Copy on current shell
    await userEvent.click(screen.getByText("Copy"));
    // Switch shell
    await userEvent.click(screen.getByText("Bash"));
    // Should show copy button (not copied)
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("shows PowerShell command by default on Windows", () => {
    render(<ShellInitStep t={mockT} />);
    expect(screen.getByText("$PROFILE")).toBeInTheDocument();
    expect(screen.getByText(/\$env:PATH/)).toBeInTheDocument();
  });
});

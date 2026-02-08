import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShellInitStep } from "./shell-init-step";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
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
});

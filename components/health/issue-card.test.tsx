import { render, screen, fireEvent } from "@testing-library/react";
import { IssueCard } from "./issue-card";

describe("IssueCard", () => {
  const mockOnCopy = jest.fn();
  const mockT = (key: string) => key;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders issue message", () => {
    render(
      <IssueCard
        issue={{
          message: "Missing PATH entry",
          severity: "warning",
          category: "path_conflict",
          details: null,
          fix_command: null,
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(screen.getByText("Missing PATH entry")).toBeInTheDocument();
  });

  it("renders destructive variant for critical severity", () => {
    const { container } = render(
      <IssueCard
        issue={{
          message: "Critical error",
          severity: "critical",
          category: "other",
          details: null,
          fix_command: null,
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(container.querySelector('[data-variant="destructive"], [role="alert"]')).toBeInTheDocument();
  });

  it("renders fix command with copy button", () => {
    render(
      <IssueCard
        issue={{
          message: "PATH not set",
          severity: "info",
          category: "shell_integration",
          details: null,
          fix_command: "export PATH=$PATH:/usr/local/bin",
          fix_description: "Add to your shell profile",
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(screen.getByText("export PATH=$PATH:/usr/local/bin")).toBeInTheDocument();
    expect(screen.getByText("Add to your shell profile")).toBeInTheDocument();
  });

  it("calls onCopy when copy button is clicked", () => {
    render(
      <IssueCard
        issue={{
          message: "Fix needed",
          severity: "warning",
          category: "missing_dependency",
          details: null,
          fix_command: "npm install -g node",
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    const copyBtn = screen.getByTitle("copyCommand");
    fireEvent.click(copyBtn);
    expect(mockOnCopy).toHaveBeenCalledWith("npm install -g node");
  });

  it("renders details when provided", () => {
    render(
      <IssueCard
        issue={{
          message: "Error",
          severity: "error",
          category: "config_error",
          details: "Detailed explanation here",
          fix_command: null,
          fix_description: null,
        }}
        onCopy={mockOnCopy}
        t={mockT}
      />,
    );
    expect(screen.getByText("Detailed explanation here")).toBeInTheDocument();
  });

  it("renders remediation actions and calls preview handler", async () => {
    const onPreviewRemediation = jest.fn().mockResolvedValue({
      remediation_id: "install-provider:fnm",
      supported: true,
      dry_run: true,
      executed: false,
      success: true,
      manual_only: false,
      command: "winget install Schniz.fnm",
      description: "Install fnm",
      message: "Preview install command for fnm",
      stdout: null,
      stderr: null,
    });

    render(
      <IssueCard
        issue={{
          message: "Provider missing",
          severity: "info",
          category: "provider_not_found",
          details: null,
          fix_command: "winget install Schniz.fnm",
          fix_description: "Install fnm",
          remediation_id: "install-provider:fnm",
        }}
        onCopy={mockOnCopy}
        onPreviewRemediation={onPreviewRemediation}
        t={mockT}
      />,
    );

    fireEvent.click(screen.getByText("previewFix"));
    expect(onPreviewRemediation).toHaveBeenCalledWith({ remediation_id: "install-provider:fnm" });
  });
});

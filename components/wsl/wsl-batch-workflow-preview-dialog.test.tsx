import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslBatchWorkflowPreviewDialog } from "./wsl-batch-workflow-preview-dialog";

const t = (key: string) => key;

describe("WslBatchWorkflowPreviewDialog", () => {
  it("renders preview details and confirms execution", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <WslBatchWorkflowPreviewDialog
        open
        workflowName="Preview workflow"
        preview={{
          workflowName: "Preview workflow",
          actionLabel: "Echo ok",
          risk: "safe",
          longRunning: false,
          requiresConfirmation: false,
          backupCoverage: "unprotected",
          warnings: ["Mutating maintenance steps do not have backup coverage."],
          refreshTargets: [],
          steps: [
            {
              stepId: "backup",
              label: "Backup distro",
              kind: "backup",
              risk: "safe",
              longRunning: true,
              mutating: false,
              backupCoverage: "not-applicable",
            },
            {
              stepId: "upgrade",
              label: "Upgrade packages",
              kind: "package-upkeep",
              risk: "safe",
              longRunning: true,
              mutating: true,
              backupCoverage: "unprotected",
            },
          ],
          runnableCount: 1,
          blockedCount: 0,
          skippedCount: 1,
          missingCount: 0,
          targets: [
            {
              distroName: "Ubuntu",
              status: "runnable",
              backupCoverage: "unprotected",
              stepStatuses: [],
            },
            {
              distroName: "Debian",
              status: "skipped",
              reason: "Already stopped",
              backupCoverage: "unprotected",
              stepStatuses: [],
            },
          ],
        }}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        t={t}
      />,
    );

    expect(screen.getByTestId("wsl-batch-workflow-preview")).toBeInTheDocument();
    expect(screen.getByText("Backup distro")).toBeInTheDocument();
    expect(screen.getByText("Upgrade packages")).toBeInTheDocument();
    expect(
      screen.getByText("Mutating maintenance steps do not have backup coverage."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.confirm" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});


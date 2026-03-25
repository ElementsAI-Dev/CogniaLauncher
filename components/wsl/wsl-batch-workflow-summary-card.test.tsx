import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslBatchWorkflowSummaryCard } from "./wsl-batch-workflow-summary-card";

const t = (key: string) => key;

describe("WslBatchWorkflowSummaryCard", () => {
  it("renders summary history and retries retryable failures", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();

    render(
      <WslBatchWorkflowSummaryCard
        summary={{
          id: "summary-1",
          workflowName: "Latest workflow",
          actionLabel: "Echo ok",
          startedAt: "2026-03-12T00:00:00.000Z",
          completedAt: "2026-03-12T00:01:00.000Z",
          total: 2,
          succeeded: 1,
          failed: 1,
          skipped: 0,
          refreshTargets: [],
          workflow: {
            id: "preset-1",
            name: "Latest workflow",
            createdAt: "2026-03-12T00:00:00.000Z",
            updatedAt: "2026-03-12T00:00:00.000Z",
            target: { mode: "selected" },
            steps: [
              {
                id: "backup",
                kind: "backup",
                label: "Backup distro",
                destinationPath: "C:\\WSL-Backups",
              },
              {
                id: "upgrade",
                kind: "package-upkeep",
                mode: "upgrade",
                label: "Upgrade packages",
              },
            ],
          },
          results: [
            { distroName: "Ubuntu", status: "success", retryable: false },
            { distroName: "Debian", status: "failed", retryable: true, detail: "boom" },
          ],
          stepResults: [
            {
              stepId: "backup",
              stepLabel: "Backup distro",
              succeeded: 2,
              failed: 0,
              skipped: 0,
              results: [
                {
                  stepId: "backup",
                  stepLabel: "Backup distro",
                  distroName: "Ubuntu",
                  status: "success",
                  retryable: false,
                },
                {
                  stepId: "backup",
                  stepLabel: "Backup distro",
                  distroName: "Debian",
                  status: "success",
                  retryable: false,
                },
              ],
            },
            {
              stepId: "upgrade",
              stepLabel: "Upgrade packages",
              succeeded: 1,
              failed: 1,
              skipped: 0,
              results: [
                {
                  stepId: "upgrade",
                  stepLabel: "Upgrade packages",
                  distroName: "Ubuntu",
                  status: "success",
                  retryable: false,
                },
                {
                  stepId: "upgrade",
                  stepLabel: "Upgrade packages",
                  distroName: "Debian",
                  status: "failed",
                  retryable: true,
                  detail: "boom",
                },
              ],
            },
          ],
          resumeFromStepIndex: 1,
        }}
        summaries={[
          {
            id: "summary-0",
            workflowName: "Previous workflow",
            actionLabel: "Health Check",
            startedAt: "2026-03-11T00:00:00.000Z",
            completedAt: "2026-03-11T00:01:00.000Z",
            total: 1,
            succeeded: 1,
            failed: 0,
            skipped: 0,
            refreshTargets: [],
            workflow: {
              id: "preset-0",
              name: "Previous workflow",
              createdAt: "2026-03-11T00:00:00.000Z",
              updatedAt: "2026-03-11T00:00:00.000Z",
              target: { mode: "selected" },
              steps: [{ id: "health", kind: "health-check", label: "Health Check" }],
            },
            results: [{ distroName: "Ubuntu", status: "success", retryable: false }],
            stepResults: [
              {
                stepId: "health",
                stepLabel: "Health Check",
                succeeded: 1,
                failed: 0,
                skipped: 0,
                results: [
                  {
                    stepId: "health",
                    stepLabel: "Health Check",
                    distroName: "Ubuntu",
                    status: "success",
                    retryable: false,
                  },
                ],
              },
            ],
            resumeFromStepIndex: null,
          },
        ]}
        onRetry={onRetry}
        t={t}
      />,
    );

    expect(screen.getByTestId("wsl-batch-workflow-summary")).toBeInTheDocument();
    expect(screen.getByText("Backup distro")).toBeInTheDocument();
    expect(screen.getByText("Upgrade packages")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "wsl.batchWorkflow.retryFailed" }));
    expect(onRetry).toHaveBeenCalled();
  });
});


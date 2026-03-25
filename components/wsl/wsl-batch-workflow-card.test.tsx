import { useState } from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslBatchWorkflowCard } from "./wsl-batch-workflow-card";
import type {
  WslAssistanceActionDescriptor,
  WslBatchWorkflowPreset,
  WslDistroStatus,
} from "@/types/wsl";

const t = (key: string) => {
  const dict: Record<string, string> = {
    "wsl.batchWorkflow.title": "Batch Workflow",
    "wsl.batchWorkflow.desc": "Run a preset workflow for selected distros.",
    "wsl.batchWorkflow.workflowName": "Workflow Name",
    "wsl.batchWorkflow.namePlaceholder": "Workflow name",
    "wsl.batchWorkflow.targetMode": "Target Mode",
    "wsl.batchWorkflow.targetSelected": "Selected Distros",
    "wsl.batchWorkflow.targetTag": "Tag Filter",
    "wsl.batchWorkflow.targetExplicit": "Explicit List",
    "wsl.batchWorkflow.addStep": "Add Step",
    "wsl.batchWorkflow.tagPlaceholder": "Choose tag",
    "wsl.batchWorkflow.actionType": "Action Type",
    "wsl.batchWorkflow.lifecycle": "Lifecycle",
    "wsl.batchWorkflow.command": "Command",
    "wsl.batchWorkflow.commandPreset": "Command Preset",
    "wsl.batchWorkflow.commandCustom": "Custom Command",
    "wsl.batchWorkflow.assistance": "Assistance",
    "wsl.batchWorkflow.backup": "Backup",
    "wsl.batchWorkflow.healthCheck": "Health Check",
    "wsl.batchWorkflow.packageUpkeep": "Package Upkeep",
    "wsl.batchWorkflow.packageUpkeepUpdate": "Update",
    "wsl.batchWorkflow.packageUpkeepUpgrade": "Upgrade",
    "wsl.batchWorkflow.relaunch": "Relaunch",
    "wsl.batchWorkflow.savePreset": "Save Preset",
    "wsl.batchWorkflow.runPreview": "Run Preview",
    "wsl.batchWorkflow.savedPresets": "Saved Presets",
    "wsl.exec.commandPlaceholder": "Enter command",
    "wsl.workspaceContext.reference": "Assistance actions reference: {name}",
    "wsl.launch": "Launch",
    "wsl.terminate": "Terminate",
    "wsl.assistance.preflight": "Runtime Preflight",
    "common.save": "Save",
  };
  return dict[key] ?? key;
};

const distros: WslDistroStatus[] = [
  { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true },
  { name: "Debian", state: "Stopped", wslVersion: "2", isDefault: false },
];

const assistanceActions: WslAssistanceActionDescriptor[] = [
  {
    id: "runtime.preflight",
    scope: "runtime",
    category: "check",
    risk: "safe",
    labelKey: "wsl.assistance.preflight",
    descriptionKey: "wsl.assistance.preflight.desc",
    supported: true,
  },
];

const draftBase: WslBatchWorkflowPreset = {
  id: "draft-1",
  name: "Nightly Check",
  target: { mode: "selected" },
  createdAt: "2026-03-19T00:00:00.000Z",
  updatedAt: "2026-03-19T00:00:00.000Z",
  steps: [
    {
      id: "step-1",
      kind: "command",
      label: "Run check",
      command: "echo check",
    },
  ],
};

function getStepContainer(stepIndex: number): HTMLElement {
  const badge = screen.getByText(`#${stepIndex}`);
  const row = badge.closest("div");
  if (!row?.parentElement) {
    throw new Error(`Cannot find workflow step container #${stepIndex}`);
  }
  return row.parentElement;
}

function renderCard() {
  const onDraftChangeSpy = jest.fn<void, [WslBatchWorkflowPreset]>();
  const onSavePreset = jest.fn();
  const onRunDraft = jest.fn();
  const onEditPreset = jest.fn();
  const onRunPreset = jest.fn();
  const onDeletePreset = jest.fn();

  function Harness() {
    const [draft, setDraft] = useState<WslBatchWorkflowPreset>(draftBase);
    return (
      <WslBatchWorkflowCard
        draft={draft}
        editingPresetId={null}
        presets={[]}
        distros={distros}
        availableTags={["dev", "nightly"]}
        selectedCount={1}
        referenceDistroName="Debian"
        commandOptions={[
          { id: "cmd-1", name: "Echo preset", command: "echo from preset" },
        ]}
        assistanceActions={assistanceActions}
        onDraftChange={(next) => {
          onDraftChangeSpy(next);
          setDraft(next);
        }}
        onSavePreset={onSavePreset}
        onRunDraft={onRunDraft}
        onEditPreset={onEditPreset}
        onRunPreset={onRunPreset}
        onDeletePreset={onDeletePreset}
        t={t}
      />
    );
  }

  render(<Harness />);
  return {
    onDraftChangeSpy,
    onSavePreset,
    onRunDraft,
  };
}

describe("WslBatchWorkflowCard", () => {
  it("switches target mode to explicit and updates selected distro list", async () => {
    const user = userEvent.setup();
    const { onDraftChangeSpy } = renderCard();

    const targetModeSelect = screen.getAllByRole("combobox")[0];
    await user.click(targetModeSelect);
    await user.click(await screen.findByRole("option", { name: "Explicit List" }));

    await user.click(screen.getByText("Ubuntu"));

    await waitFor(() => {
      expect(onDraftChangeSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            mode: "explicit",
            distroNames: expect.arrayContaining(["Ubuntu"]),
          }),
        }),
      );
    });
  });

  it("adds a step and changes the new step kind to assistance", async () => {
    const user = userEvent.setup();
    const { onDraftChangeSpy } = renderCard();

    await user.click(screen.getByRole("button", { name: "Add Step" }));
    expect(await screen.findByText("#2")).toBeInTheDocument();

    const stepTwo = getStepContainer(2);
    const actionTypeSelect = within(stepTwo).getAllByRole("combobox")[0];
    await user.click(actionTypeSelect);
    await user.click(await screen.findByRole("option", { name: "Assistance" }));

    await waitFor(() => {
      const lastCallArg = onDraftChangeSpy.mock.calls.at(-1)?.[0];
      expect(lastCallArg?.steps?.[1]).toEqual(
        expect.objectContaining({
          kind: "assistance",
          actionId: "runtime.preflight",
        }),
      );
    });
  });

  it("updates command step from command preset selection", async () => {
    const user = userEvent.setup();
    const { onDraftChangeSpy } = renderCard();

    const stepOne = getStepContainer(1);
    const commandPresetSelect = within(stepOne).getAllByRole("combobox")[1];
    await user.click(commandPresetSelect);
    await user.click(await screen.findByRole("option", { name: "Echo preset" }));

    await waitFor(() => {
      const step = onDraftChangeSpy.mock.calls.at(-1)?.[0].steps?.[0];
      expect(step).toEqual(
        expect.objectContaining({
          kind: "command",
          command: "echo from preset",
          savedCommandId: "cmd-1",
        }),
      );
    });
  });

  it("changes lifecycle operation to terminate after switching step kind", async () => {
    const user = userEvent.setup();
    const { onDraftChangeSpy } = renderCard();

    const stepOne = getStepContainer(1);
    const actionTypeSelect = within(stepOne).getAllByRole("combobox")[0];
    await user.click(actionTypeSelect);
    await user.click(await screen.findByRole("option", { name: "Lifecycle" }));

    const operationSelect = within(getStepContainer(1)).getAllByRole("combobox")[1];
    await user.click(operationSelect);
    await user.click(await screen.findByRole("option", { name: "Terminate" }));

    await waitFor(() => {
      const step = onDraftChangeSpy.mock.calls.at(-1)?.[0].steps?.[0];
      expect(step).toEqual(
        expect.objectContaining({
          kind: "lifecycle",
          operation: "terminate",
        }),
      );
    });
  });

  it("falls back to a default command step when removing the only step", async () => {
    const user = userEvent.setup();
    const { onDraftChangeSpy } = renderCard();

    const stepOne = getStepContainer(1);
    const iconButtons = within(stepOne).getAllByRole("button");
    await user.click(iconButtons[iconButtons.length - 1]);

    await waitFor(() => {
      const next = onDraftChangeSpy.mock.calls.at(-1)?.[0];
      expect(next?.steps).toHaveLength(1);
      expect(next?.steps?.[0]).toEqual(
        expect.objectContaining({
          kind: "command",
        }),
      );
    });
  });

  it("triggers save and run actions", async () => {
    const user = userEvent.setup();
    const { onSavePreset, onRunDraft } = renderCard();

    await user.click(screen.getByRole("button", { name: "Save Preset" }));
    await user.click(screen.getByRole("button", { name: "Run Preview" }));

    expect(onSavePreset).toHaveBeenCalled();
    expect(onRunDraft).toHaveBeenCalled();
  });

  it("shows the active workspace reference target for assistance-driven steps", () => {
    renderCard();

    expect(
      screen.getByText("Assistance actions reference: Debian"),
    ).toBeInTheDocument();
  });
});

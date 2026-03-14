import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslBatchWorkflowCard } from './wsl-batch-workflow-card';
import { WslBatchWorkflowPreviewDialog } from './wsl-batch-workflow-preview-dialog';
import { WslBatchWorkflowSummaryCard } from './wsl-batch-workflow-summary-card';

const t = (key: string) => key;

describe('WSL batch workflow components', () => {
  it('renders workflow card actions and preset controls', async () => {
    const user = userEvent.setup();
    const onSavePreset = jest.fn();
    const onRunDraft = jest.fn();
    const onEditPreset = jest.fn();
    const onRunPreset = jest.fn();
    const onDeletePreset = jest.fn();

    render(
      <WslBatchWorkflowCard
        draft={{
          id: 'draft',
          name: 'Nightly checks',
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
          target: { mode: 'selected' },
          action: { kind: 'command', command: 'echo ok', savedCommandId: 'preset-1', label: 'Echo ok' },
        }}
        editingPresetId={null}
        presets={[
          {
            id: 'preset-1',
            name: 'Saved workflow',
            createdAt: '2026-03-12T00:00:00.000Z',
            updatedAt: '2026-03-12T00:00:00.000Z',
            target: { mode: 'selected' },
            action: { kind: 'command', command: 'echo ok', label: 'Echo ok' },
          },
        ]}
        distros={[{ name: 'Ubuntu', state: 'Running', wslVersion: '2', isDefault: true }]}
        availableTags={['dev']}
        selectedCount={1}
        commandOptions={[{ id: 'preset-1', name: 'Echo ok', command: 'echo ok' }]}
        assistanceActions={[]}
        onDraftChange={jest.fn()}
        onSavePreset={onSavePreset}
        onRunDraft={onRunDraft}
        onEditPreset={onEditPreset}
        onRunPreset={onRunPreset}
        onDeletePreset={onDeletePreset}
        t={t}
      />
    );

    await user.click(screen.getByRole('button', { name: 'wsl.batchWorkflow.savePreset' }));
    await user.click(screen.getByRole('button', { name: 'wsl.batchWorkflow.runPreview' }));
    const presetRow = screen.getByText('Saved workflow').parentElement?.parentElement;
    expect(presetRow).toBeTruthy();
    const presetButtons = within(presetRow!).getAllByRole('button');
    await user.click(presetButtons[0]);
    await user.click(presetButtons[1]);
    await user.click(presetButtons[2]);

    expect(onSavePreset).toHaveBeenCalled();
    expect(onRunDraft).toHaveBeenCalled();
    expect(onEditPreset).toHaveBeenCalled();
    expect(onRunPreset).toHaveBeenCalled();
    expect(onDeletePreset).toHaveBeenCalledWith('preset-1');
  });

  it('renders preview dialog and confirms workflow run', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(
      <WslBatchWorkflowPreviewDialog
        open
        workflowName="Preview workflow"
        preview={{
          workflowName: 'Preview workflow',
          actionLabel: 'Echo ok',
          risk: 'safe',
          longRunning: false,
          requiresConfirmation: false,
          refreshTargets: [],
          runnableCount: 1,
          blockedCount: 0,
          skippedCount: 1,
          missingCount: 0,
          targets: [
            { distroName: 'Ubuntu', status: 'runnable' },
            { distroName: 'Debian', status: 'skipped', reason: 'Already stopped' },
          ],
        }}
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
        t={t}
      />
    );

    await user.click(screen.getByRole('button', { name: 'common.confirm' }));

    expect(onConfirm).toHaveBeenCalled();
    expect(screen.getByText('Ubuntu')).toBeInTheDocument();
  });

  it('renders summary card and retries retryable failures', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();

    render(
      <WslBatchWorkflowSummaryCard
        summary={{
          id: 'summary-1',
          workflowName: 'Latest workflow',
          actionLabel: 'Echo ok',
          startedAt: '2026-03-12T00:00:00.000Z',
          completedAt: '2026-03-12T00:01:00.000Z',
          total: 2,
          succeeded: 1,
          failed: 1,
          skipped: 0,
          refreshTargets: [],
          workflow: {
            id: 'preset-1',
            name: 'Latest workflow',
            createdAt: '2026-03-12T00:00:00.000Z',
            updatedAt: '2026-03-12T00:00:00.000Z',
            target: { mode: 'selected' },
            action: { kind: 'command', command: 'echo ok', label: 'Echo ok' },
          },
          results: [
            { distroName: 'Ubuntu', status: 'success', retryable: false },
            { distroName: 'Debian', status: 'failed', retryable: true, detail: 'boom' },
          ],
        }}
        onRetry={onRetry}
        t={t}
      />
    );

    await user.click(screen.getByRole('button', { name: 'wsl.batchWorkflow.retryFailed' }));

    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByText('Latest workflow')).toBeInTheDocument();
  });
});

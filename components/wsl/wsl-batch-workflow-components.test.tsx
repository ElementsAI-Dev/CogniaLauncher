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
          steps: [
            { id: 'backup', kind: 'backup', label: 'Backup distro', destinationPath: 'C:\\WSL-Backups' },
            { id: 'upgrade', kind: 'package-upkeep', mode: 'upgrade', label: 'Upgrade packages' },
          ],
        }}
        editingPresetId={null}
        presets={[
          {
            id: 'preset-1',
            name: 'Saved workflow',
            createdAt: '2026-03-12T00:00:00.000Z',
            updatedAt: '2026-03-12T00:00:00.000Z',
            target: { mode: 'selected' },
            steps: [{ id: 'health', kind: 'health-check', label: 'Health Check' }],
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

    expect(screen.getByDisplayValue('Backup distro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Upgrade packages')).toBeInTheDocument();
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
          backupCoverage: 'unprotected',
          warnings: ['Mutating maintenance steps do not have backup coverage.'],
          refreshTargets: [],
          steps: [
            {
              stepId: 'backup',
              label: 'Backup distro',
              kind: 'backup',
              risk: 'safe',
              longRunning: true,
              mutating: false,
              backupCoverage: 'not-applicable',
            },
            {
              stepId: 'upgrade',
              label: 'Upgrade packages',
              kind: 'package-upkeep',
              risk: 'safe',
              longRunning: true,
              mutating: true,
              backupCoverage: 'unprotected',
            },
          ],
          runnableCount: 1,
          blockedCount: 0,
          skippedCount: 1,
          missingCount: 0,
          targets: [
            {
              distroName: 'Ubuntu',
              status: 'runnable',
              backupCoverage: 'unprotected',
              stepStatuses: [],
            },
            {
              distroName: 'Debian',
              status: 'skipped',
              reason: 'Already stopped',
              backupCoverage: 'unprotected',
              stepStatuses: [],
            },
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
    expect(screen.getByText('Backup distro')).toBeInTheDocument();
    expect(screen.getByText('Upgrade packages')).toBeInTheDocument();
    expect(screen.getByText('Mutating maintenance steps do not have backup coverage.')).toBeInTheDocument();
  });

  it('renders summary card history, step breakdown, and retries retryable failures', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    const SummaryCard = WslBatchWorkflowSummaryCard as unknown as (props: Record<string, unknown>) => JSX.Element;

    render(
      <SummaryCard
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
            steps: [
              { id: 'backup', kind: 'backup', label: 'Backup distro', destinationPath: 'C:\\WSL-Backups' },
              { id: 'upgrade', kind: 'package-upkeep', mode: 'upgrade', label: 'Upgrade packages' },
            ],
          },
          results: [
            { distroName: 'Ubuntu', status: 'success', retryable: false },
            { distroName: 'Debian', status: 'failed', retryable: true, detail: 'boom' },
          ],
          stepResults: [
            {
              stepId: 'backup',
              stepLabel: 'Backup distro',
              succeeded: 2,
              failed: 0,
              skipped: 0,
              results: [
                { stepId: 'backup', stepLabel: 'Backup distro', distroName: 'Ubuntu', status: 'success', retryable: false },
                { stepId: 'backup', stepLabel: 'Backup distro', distroName: 'Debian', status: 'success', retryable: false },
              ],
            },
            {
              stepId: 'upgrade',
              stepLabel: 'Upgrade packages',
              succeeded: 1,
              failed: 1,
              skipped: 0,
              results: [
                { stepId: 'upgrade', stepLabel: 'Upgrade packages', distroName: 'Ubuntu', status: 'success', retryable: false },
                { stepId: 'upgrade', stepLabel: 'Upgrade packages', distroName: 'Debian', status: 'failed', retryable: true, detail: 'boom' },
              ],
            },
          ],
          resumeFromStepIndex: 1,
        }}
        summaries={[
          {
            id: 'summary-0',
            workflowName: 'Previous workflow',
            actionLabel: 'Health Check',
            startedAt: '2026-03-11T00:00:00.000Z',
            completedAt: '2026-03-11T00:01:00.000Z',
            total: 1,
            succeeded: 1,
            failed: 0,
            skipped: 0,
            refreshTargets: [],
            workflow: {
              id: 'preset-0',
              name: 'Previous workflow',
              createdAt: '2026-03-11T00:00:00.000Z',
              updatedAt: '2026-03-11T00:00:00.000Z',
              target: { mode: 'selected' },
              steps: [{ id: 'health', kind: 'health-check', label: 'Health Check' }],
            },
            results: [{ distroName: 'Ubuntu', status: 'success', retryable: false }],
            stepResults: [
              {
                stepId: 'health',
                stepLabel: 'Health Check',
                succeeded: 1,
                failed: 0,
                skipped: 0,
                results: [{ stepId: 'health', stepLabel: 'Health Check', distroName: 'Ubuntu', status: 'success', retryable: false }],
              },
            ],
            resumeFromStepIndex: null,
          },
        ]}
        onRetry={onRetry}
        t={t}
      />
    );

    await user.click(screen.getByRole('button', { name: 'wsl.batchWorkflow.retryFailed' }));

    expect(onRetry).toHaveBeenCalled();
    expect(screen.getAllByText('Latest workflow').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Previous workflow' })).toBeInTheDocument();
    expect(screen.getByText('Backup distro')).toBeInTheDocument();
    expect(screen.getByText('Upgrade packages')).toBeInTheDocument();
  });
});

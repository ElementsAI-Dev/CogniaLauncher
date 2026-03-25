'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { getWslBatchWorkflowSteps, normalizeWslBatchWorkflowPreset } from '@/lib/wsl/workflow';
import type {
  WslBatchWorkflowActionKind,
  WslBatchWorkflowCardProps,
  WslBatchWorkflowPreset,
  WslBatchWorkflowStep,
} from '@/types/wsl';

const distroStateColor: Record<string, string> = {
  running: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  stopped: 'bg-muted text-muted-foreground',
};

function cloneWorkflowDraft(draft: WslBatchWorkflowPreset, updates: Partial<WslBatchWorkflowPreset>) {
  return normalizeWslBatchWorkflowPreset({
    ...draft,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

function buildStepLabel(kind: WslBatchWorkflowActionKind, t: WslBatchWorkflowCardProps['t']) {
  switch (kind) {
    case 'backup':
      return t('wsl.batchWorkflow.backup');
    case 'package-upkeep':
      return t('wsl.batchWorkflow.packageUpkeep');
    case 'health-check':
      return t('wsl.batchWorkflow.healthCheck');
    case 'lifecycle':
      return t('wsl.batchWorkflow.lifecycle');
    case 'assistance':
      return t('wsl.batchWorkflow.assistance');
    case 'command':
    default:
      return t('wsl.batchWorkflow.command');
  }
}

function createStep(
  kind: WslBatchWorkflowActionKind,
  index: number,
  commandOptions: WslBatchWorkflowCardProps['commandOptions'],
  assistanceActions: WslBatchWorkflowCardProps['assistanceActions'],
  t: WslBatchWorkflowCardProps['t'],
): WslBatchWorkflowStep {
  const id = `${kind}-${Date.now()}-${index}`;

  if (kind === 'lifecycle') {
    return {
      id,
      kind: 'lifecycle',
      operation: 'launch',
      label: t('wsl.launch'),
    };
  }

  if (kind === 'assistance') {
    const firstAction = assistanceActions[0];
    return {
      id,
      kind: 'assistance',
      actionId: firstAction?.id ?? 'distro.preflight',
      label: firstAction ? t(firstAction.labelKey) : t('wsl.batchWorkflow.assistance'),
    };
  }

  if (kind === 'backup') {
    return {
      id,
      kind: 'backup',
      destinationPath: '%USERPROFILE%\\WSL-Backups',
      label: t('wsl.batchWorkflow.backup'),
    };
  }

  if (kind === 'package-upkeep') {
    return {
      id,
      kind: 'package-upkeep',
      mode: 'upgrade',
      label: t('wsl.batchWorkflow.packageUpkeep'),
    };
  }

  if (kind === 'health-check') {
    return {
      id,
      kind: 'health-check',
      label: t('wsl.batchWorkflow.healthCheck'),
    };
  }

  const firstCommand = commandOptions[0];
  return {
    id,
    kind: 'command',
    command: firstCommand?.command ?? '',
    user: firstCommand?.user,
    savedCommandId: firstCommand?.id,
    label: firstCommand?.name ?? t('wsl.batchWorkflow.command'),
  };
}

function describePreset(preset: WslBatchWorkflowPreset) {
  const steps = getWslBatchWorkflowSteps(preset);
  if (steps.length === 0) {
    return '';
  }
  if (steps.length === 1) {
    return steps[0].label ?? steps[0].kind;
  }
  return `${steps.length} steps`;
}

export function WslBatchWorkflowCard({
  draft,
  editingPresetId,
  presets,
  distros,
  availableTags,
  selectedCount,
  referenceDistroName,
  commandOptions,
  assistanceActions,
  onDraftChange,
  onSavePreset,
  onRunDraft,
  onEditPreset,
  onRunPreset,
  onDeletePreset,
  t,
}: WslBatchWorkflowCardProps) {
  const normalizedDraft = useMemo(() => normalizeWslBatchWorkflowPreset(draft), [draft]);
  const draftSteps = normalizedDraft.steps ?? [];

  const updateDraft = (updates: Partial<WslBatchWorkflowPreset>) => {
    onDraftChange(cloneWorkflowDraft(normalizedDraft, updates));
  };

  const updateSteps = (steps: WslBatchWorkflowStep[]) => {
    updateDraft({ steps });
  };

  const handleTargetModeChange = (mode: string) => {
    updateDraft({
      target: {
        mode: mode as 'selected' | 'tag' | 'explicit',
        tag: mode === 'tag' ? (normalizedDraft.target.tag ?? availableTags[0] ?? null) || undefined : undefined,
        distroNames: mode === 'explicit' ? (normalizedDraft.target.distroNames ?? []) : undefined,
      },
    });
  };

  const replaceStep = (stepIndex: number, nextStep: WslBatchWorkflowStep) => {
    updateSteps(draftSteps.map((step, index) => (index === stepIndex ? nextStep : step)));
  };

  const changeStepKind = (stepIndex: number, nextKind: string) => {
    const replacement = createStep(
      nextKind as WslBatchWorkflowActionKind,
      stepIndex,
      commandOptions,
      assistanceActions,
      t,
    );
    replaceStep(stepIndex, replacement);
  };

  const moveStep = (stepIndex: number, direction: -1 | 1) => {
    const nextIndex = stepIndex + direction;
    if (nextIndex < 0 || nextIndex >= draftSteps.length) {
      return;
    }

    const nextSteps = [...draftSteps];
    [nextSteps[stepIndex], nextSteps[nextIndex]] = [nextSteps[nextIndex], nextSteps[stepIndex]];
    updateSteps(nextSteps);
  };

  const removeStep = (stepIndex: number) => {
    const nextSteps = draftSteps.filter((_, index) => index !== stepIndex);
    updateSteps(nextSteps.length > 0 ? nextSteps : [
      createStep('command', 0, commandOptions, assistanceActions, t),
    ]);
  };

  const addStep = () => {
    updateSteps([
      ...draftSteps,
      createStep('health-check', draftSteps.length, commandOptions, assistanceActions, t),
    ]);
  };

  return (
    <Card data-testid="wsl-batch-workflow-card">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold">{t('wsl.batchWorkflow.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('wsl.batchWorkflow.desc')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('wsl.batchWorkflow.workflowName')}</Label>
          <Input
            value={normalizedDraft.name}
            placeholder={t('wsl.batchWorkflow.namePlaceholder')}
            onChange={(event) => updateDraft({ name: event.target.value })}
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={normalizedDraft.target.mode} onValueChange={handleTargetModeChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('wsl.batchWorkflow.targetMode')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="selected">{t('wsl.batchWorkflow.targetSelected')} ({selectedCount})</SelectItem>
              <SelectItem value="tag">{t('wsl.batchWorkflow.targetTag')}</SelectItem>
              <SelectItem value="explicit">{t('wsl.batchWorkflow.targetExplicit')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={addStep}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('wsl.batchWorkflow.addStep')}
          </Button>
        </div>

        {referenceDistroName && (
          <p className="text-xs text-muted-foreground">
            {t('wsl.workspaceContext.reference').replace('{name}', referenceDistroName)}
          </p>
        )}

        {normalizedDraft.target.mode === 'tag' && (
          <Select
            value={normalizedDraft.target.tag ?? ''}
            onValueChange={(value) => updateDraft({
              target: { mode: 'tag', tag: value },
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('wsl.batchWorkflow.tagPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {availableTags.map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {normalizedDraft.target.mode === 'explicit' && (
          <ScrollArea className="max-h-48">
            <div className="space-y-1 rounded-md border p-2">
              {distros.map((distro) => {
                const checked = (normalizedDraft.target.distroNames ?? []).includes(distro.name);
                const stateKey = distro.state.toLowerCase();
                return (
                  <label key={distro.name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        const current = new Set(normalizedDraft.target.distroNames ?? []);
                        if (checked) {
                          current.delete(distro.name);
                        } else {
                          current.add(distro.name);
                        }
                        updateDraft({
                          target: { mode: 'explicit', distroNames: Array.from(current) },
                        });
                      }}
                    />
                    <span className="flex-1 truncate">{distro.name}</span>
                    <Badge variant="outline" className={distroStateColor[stateKey] ?? ''}>{distro.state}</Badge>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <Separator />

        <div className="space-y-3">
          {draftSteps.map((step, stepIndex) => (
            <div key={step.id} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">#{stepIndex + 1}</Badge>
                <Input
                  value={step.label ?? ''}
                  placeholder={buildStepLabel(step.kind, t)}
                  onChange={(event) => replaceStep(stepIndex, { ...step, label: event.target.value })}
                  className="h-8"
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(stepIndex, -1)} disabled={stepIndex === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(stepIndex, 1)} disabled={stepIndex === draftSteps.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStep(stepIndex)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Select value={step.kind} onValueChange={(value) => changeStepKind(stepIndex, value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('wsl.batchWorkflow.actionType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backup">{t('wsl.batchWorkflow.backup')}</SelectItem>
                  <SelectItem value="package-upkeep">{t('wsl.batchWorkflow.packageUpkeep')}</SelectItem>
                  <SelectItem value="health-check">{t('wsl.batchWorkflow.healthCheck')}</SelectItem>
                  <SelectItem value="command">{t('wsl.batchWorkflow.command')}</SelectItem>
                  <SelectItem value="assistance">{t('wsl.batchWorkflow.assistance')}</SelectItem>
                  <SelectItem value="lifecycle">{t('wsl.batchWorkflow.lifecycle')}</SelectItem>
                </SelectContent>
              </Select>

              {step.kind === 'lifecycle' && (
                <Select
                  value={step.operation}
                  onValueChange={(value) => replaceStep(stepIndex, {
                    ...step,
                    operation: value as 'launch' | 'terminate' | 'relaunch',
                    label: value === 'launch' ? t('wsl.launch') : value === 'terminate' ? t('wsl.terminate') : t('wsl.batchWorkflow.relaunch'),
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('wsl.batchWorkflow.lifecycle')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="launch">{t('wsl.launch')}</SelectItem>
                    <SelectItem value="terminate">{t('wsl.terminate')}</SelectItem>
                    <SelectItem value="relaunch">{t('wsl.batchWorkflow.relaunch')}</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {step.kind === 'command' && (
                <div className="space-y-2">
                  <Select
                    value={step.savedCommandId ?? '__custom__'}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        replaceStep(stepIndex, {
                          ...step,
                          savedCommandId: undefined,
                        });
                        return;
                      }

                      const commandOption = commandOptions.find((entry) => entry.id === value);
                      if (!commandOption) return;

                      replaceStep(stepIndex, {
                        ...step,
                        command: commandOption.command,
                        user: commandOption.user,
                        savedCommandId: commandOption.id,
                        label: step.label || commandOption.name,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('wsl.batchWorkflow.commandPreset')} />
                    </SelectTrigger>
                    <SelectContent>
                      {commandOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">{t('wsl.batchWorkflow.commandCustom')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={step.command}
                    placeholder={t('wsl.exec.commandPlaceholder')}
                    onChange={(event) => replaceStep(stepIndex, { ...step, command: event.target.value })}
                  />
                </div>
              )}

              {step.kind === 'assistance' && (
                <Select
                  value={step.actionId}
                  onValueChange={(value) => {
                    const actionOption = assistanceActions.find((entry) => entry.id === value);
                    replaceStep(stepIndex, {
                      ...step,
                      actionId: value,
                      label: step.label || (actionOption ? t(actionOption.labelKey) : value),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('wsl.batchWorkflow.assistance')} />
                  </SelectTrigger>
                  <SelectContent>
                    {assistanceActions.map((action) => (
                      <SelectItem key={action.id} value={action.id}>{t(action.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {step.kind === 'backup' && (
                <Input
                  value={step.destinationPath ?? ''}
                  placeholder="%USERPROFILE%\\WSL-Backups"
                  onChange={(event) => replaceStep(stepIndex, { ...step, destinationPath: event.target.value })}
                />
              )}

              {step.kind === 'package-upkeep' && (
                <Select
                  value={step.mode}
                  onValueChange={(value) => replaceStep(stepIndex, {
                    ...step,
                    mode: value as 'update' | 'upgrade',
                    label: step.label || (value === 'upgrade' ? t('wsl.batchWorkflow.packageUpkeepUpgrade') : t('wsl.batchWorkflow.packageUpkeepUpdate')),
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('wsl.batchWorkflow.packageUpkeep')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">{t('wsl.batchWorkflow.packageUpkeepUpdate')}</SelectItem>
                    <SelectItem value="upgrade">{t('wsl.batchWorkflow.packageUpkeepUpgrade')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onSavePreset}>
            {editingPresetId ? t('common.save') : t('wsl.batchWorkflow.savePreset')}
          </Button>
          <Button size="sm" onClick={onRunDraft} className="gap-1.5">
            <Play className="h-3 w-3" />
            {t('wsl.batchWorkflow.runPreview')}
          </Button>
        </div>

        {presets.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">{t('wsl.batchWorkflow.savedPresets')}</Label>
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                <div className="space-y-0.5 min-w-0">
                  <p className="font-medium truncate">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{describePreset(preset)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditPreset(preset)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRunPreset(preset)}>
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeletePreset(preset.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

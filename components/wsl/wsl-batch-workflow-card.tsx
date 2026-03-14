'use client';

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
import { Play, Pencil, Trash2 } from 'lucide-react';
import type { WslBatchWorkflowCardProps, WslBatchWorkflowPreset } from '@/types/wsl';

const distroStateColor: Record<string, string> = {
  running: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  stopped: 'bg-muted text-muted-foreground',
};

function cloneWorkflowDraft(draft: WslBatchWorkflowPreset, updates: Partial<WslBatchWorkflowPreset>) {
  return {
    ...draft,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

export function WslBatchWorkflowCard({
  draft,
  editingPresetId,
  presets,
  distros,
  availableTags,
  selectedCount,
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
  const handleActionKindChange = (kind: string) => {
    if (kind === 'lifecycle') {
      onDraftChange(cloneWorkflowDraft(draft, {
        action: { kind: 'lifecycle', operation: 'launch', label: t('wsl.launch') },
      }));
      return;
    }

    if (kind === 'command') {
      const firstCommand = commandOptions[0];
      onDraftChange(cloneWorkflowDraft(draft, {
        action: {
          kind: 'command',
          command: firstCommand?.command ?? '',
          user: firstCommand?.user,
          savedCommandId: firstCommand?.id,
          label: firstCommand?.name ?? t('wsl.batchWorkflow.command'),
        },
      }));
      return;
    }

    if (kind === 'assistance') {
      const firstAction = assistanceActions[0];
      onDraftChange(cloneWorkflowDraft(draft, {
        action: {
          kind: 'assistance',
          actionId: firstAction?.id ?? 'distro.preflight',
          label: firstAction ? t(firstAction.labelKey) : t('wsl.batchWorkflow.assistance'),
        },
      }));
      return;
    }

    onDraftChange(cloneWorkflowDraft(draft, {
      action: { kind: 'health-check', label: t('wsl.batchWorkflow.healthCheck') },
    }));
  };

  const handleTargetModeChange = (mode: string) => {
    onDraftChange(cloneWorkflowDraft(draft, {
      target: {
        mode: mode as 'selected' | 'tag' | 'explicit',
        tag: mode === 'tag' ? (draft.target.tag ?? availableTags[0] ?? null) || undefined : undefined,
        distroNames: mode === 'explicit' ? (draft.target.distroNames ?? []) : undefined,
      },
    }));
  };

  const commandAction = draft.action.kind === 'command' ? draft.action : null;

  return (
    <Card data-testid="wsl-batch-workflow-card">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold">{t('wsl.batchWorkflow.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('wsl.batchWorkflow.desc')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('wsl.batchWorkflow.workflowName')}</Label>
          <Input
            value={draft.name}
            placeholder={t('wsl.batchWorkflow.namePlaceholder')}
            onChange={(event) => onDraftChange(cloneWorkflowDraft(draft, { name: event.target.value }))}
            className="h-9"
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={draft.action.kind} onValueChange={handleActionKindChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('wsl.batchWorkflow.actionType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lifecycle">{t('wsl.batchWorkflow.lifecycle')}</SelectItem>
              <SelectItem value="command">{t('wsl.batchWorkflow.command')}</SelectItem>
              <SelectItem value="health-check">{t('wsl.batchWorkflow.healthCheck')}</SelectItem>
              <SelectItem value="assistance">{t('wsl.batchWorkflow.assistance')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={draft.target.mode} onValueChange={handleTargetModeChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('wsl.batchWorkflow.targetMode')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="selected">{t('wsl.batchWorkflow.targetSelected')} ({selectedCount})</SelectItem>
              <SelectItem value="tag">{t('wsl.batchWorkflow.targetTag')}</SelectItem>
              <SelectItem value="explicit">{t('wsl.batchWorkflow.targetExplicit')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {draft.action.kind === 'lifecycle' && (
          <Select
            value={draft.action.operation}
            onValueChange={(value) => onDraftChange(cloneWorkflowDraft(draft, {
              action: {
                kind: 'lifecycle',
                operation: value as 'launch' | 'terminate',
                label: value === 'launch' ? t('wsl.launch') : t('wsl.terminate'),
              },
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('wsl.batchWorkflow.lifecycle')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="launch">{t('wsl.launch')}</SelectItem>
              <SelectItem value="terminate">{t('wsl.terminate')}</SelectItem>
            </SelectContent>
          </Select>
        )}

        {commandAction && (
          <div className="space-y-2">
            <Select
              value={commandAction.savedCommandId ?? '__custom__'}
              onValueChange={(value) => {
                if (value === '__custom__') {
                  onDraftChange(cloneWorkflowDraft(draft, {
                    action: {
                      kind: 'command',
                      command: commandAction.command,
                      user: commandAction.user,
                      savedCommandId: undefined,
                      label: commandAction.label,
                    },
                  }));
                  return;
                }

                const commandOption = commandOptions.find((entry) => entry.id === value);
                if (!commandOption) return;

                onDraftChange(cloneWorkflowDraft(draft, {
                  action: {
                    kind: 'command',
                    command: commandOption.command,
                    user: commandOption.user,
                    savedCommandId: commandOption.id,
                    label: commandOption.name,
                  },
                }));
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
              value={commandAction.command}
              placeholder={t('wsl.exec.commandPlaceholder')}
              onChange={(event) => onDraftChange(cloneWorkflowDraft(draft, {
                action: {
                  ...commandAction,
                  command: event.target.value,
                },
              }))}
            />
          </div>
        )}

        {draft.action.kind === 'assistance' && (
          <Select
            value={draft.action.actionId}
            onValueChange={(value) => {
              const actionOption = assistanceActions.find((entry) => entry.id === value);
              onDraftChange(cloneWorkflowDraft(draft, {
                action: {
                  kind: 'assistance',
                  actionId: value,
                  label: actionOption ? t(actionOption.labelKey) : value,
                },
              }));
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

        {draft.target.mode === 'tag' && (
          <Select
            value={draft.target.tag ?? ''}
            onValueChange={(value) => onDraftChange(cloneWorkflowDraft(draft, {
              target: { mode: 'tag', tag: value },
            }))}
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

        {draft.target.mode === 'explicit' && (
          <ScrollArea className="max-h-48">
            <div className="space-y-1 rounded-md border p-2">
              {distros.map((distro) => {
                const checked = (draft.target.distroNames ?? []).includes(distro.name);
                const stateKey = distro.state.toLowerCase();
                return (
                  <label key={distro.name} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        const current = new Set(draft.target.distroNames ?? []);
                        if (checked) current.delete(distro.name);
                        else current.add(distro.name);

                        onDraftChange(cloneWorkflowDraft(draft, {
                          target: { mode: 'explicit', distroNames: Array.from(current) },
                        }));
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
                  <p className="text-xs text-muted-foreground">{preset.action.label ?? preset.action.kind}</p>
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

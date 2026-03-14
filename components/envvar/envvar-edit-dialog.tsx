'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, SplitSquareHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateEnvVarKey } from '@/lib/envvar';
import type { EnvVarScope } from '@/types/tauri';

const SCOPE_DOT_COLORS: Record<EnvVarScope, string> = {
  process: 'bg-muted-foreground',
  user: 'bg-blue-500',
  system: 'bg-amber-500',
};

interface EnvVarEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (key: string, value: string, scope: EnvVarScope) => void;
  editKey?: string;
  editValue?: string;
  pending?: boolean;
  t: (key: string) => string;
}

export function EnvVarEditDialog({
  open,
  onOpenChange,
  onSave,
  editKey,
  editValue,
  pending = false,
  t,
}: EnvVarEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <EnvVarEditDialogContent
            onOpenChange={onOpenChange}
            onSave={onSave}
            editKey={editKey}
            editValue={editValue}
            pending={pending}
            t={t}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EnvVarEditDialogContent({
  onOpenChange,
  onSave,
  editKey,
  editValue,
  pending = false,
  t,
}: Omit<EnvVarEditDialogProps, 'open'>) {
  const [key, setKey] = useState(editKey || '');
  const [value, setValue] = useState(editValue || '');
  const [scope, setScope] = useState<EnvVarScope>('process');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [splitView, setSplitView] = useState(false);

  const isEdit = !!editKey;
  const sep = value.includes(';') ? ';' : ':';
  const isPathLike = value.length > 60 && (value.includes(';') || value.includes(':'));
  const useTextarea = value.length > 80 || isPathLike;
  const isPersistentScope = scope === 'user' || scope === 'system';

  const handleKeyChange = (newKey: string) => {
    setKey(newKey);
    if (keyError) {
      const validation = validateEnvVarKey(newKey.trim());
      if (validation.valid) setKeyError(null);
    }
  };

  const handleSave = () => {
    if (pending) return;
    const trimmedKey = key.trim();
    const validation = validateEnvVarKey(trimmedKey);
    if (!validation.valid) {
      const msg = validation.error === 'empty'
        ? (t('envvar.errors.keyEmpty') || 'Key cannot be empty')
        : (t('envvar.errors.keyInvalid') || 'Key contains invalid characters');
      setKeyError(msg);
      return;
    }
    setKeyError(null);
    const finalValue = splitView ? value.split('\n').join(sep) : value;
    onSave(trimmedKey, finalValue, scope);
    onOpenChange(false);
  };

  const saveLabel = isEdit
    ? t('common.save')
    : `${t('envvar.actions.add')}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? t('envvar.actions.edit') : t('envvar.actions.add')}
        </DialogTitle>
        <DialogDescription>
          {t('envvar.description')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="envvar-key">{t('envvar.table.key')}</Label>
          <Input
            id="envvar-key"
            value={key}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="MY_VARIABLE"
            disabled={isEdit}
            className={cn(
              'font-mono text-sm',
              keyError && 'border-destructive focus-visible:ring-destructive/30',
            )}
          />
          {keyError && (
            <p className="text-sm text-destructive">{keyError}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="envvar-value">{t('envvar.table.value')}</Label>
            {isPathLike && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!splitView) {
                    setValue(value.split(sep).join('\n'));
                  } else {
                    setValue(value.split('\n').join(sep));
                  }
                  setSplitView(!splitView);
                }}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={splitView ? t('envvar.actions.joinView') : t('envvar.actions.splitView')}
              >
                <SplitSquareHorizontal className="h-3 w-3" />
                {splitView ? t('envvar.actions.joinView') || 'Join' : t('envvar.actions.splitView') || 'Split'}
              </Button>
            )}
          </div>
          {useTextarea || splitView ? (
            <Textarea
              id="envvar-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="/usr/local/bin"
              className="font-mono text-xs min-h-30 resize-y"
            />
          ) : (
            <Input
              id="envvar-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="/usr/local/bin"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          )}
        </div>

        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="envvar-scope">{t('envvar.table.scope')}</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as EnvVarScope)}>
              <SelectTrigger id="envvar-scope">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', SCOPE_DOT_COLORS[scope])} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="process">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', SCOPE_DOT_COLORS.process)} />
                    {t('envvar.scopes.process')}
                  </div>
                </SelectItem>
                <SelectItem value="user">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', SCOPE_DOT_COLORS.user)} />
                    {t('envvar.scopes.user')}
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', SCOPE_DOT_COLORS.system)} />
                    {t('envvar.scopes.system')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Persistent scope warning - positioned right under scope selector */}
            {isPersistentScope && (
              <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('envvar.confirm.systemWarnTitle')}</AlertTitle>
                <AlertDescription>{t('envvar.confirm.systemWarnDesc')}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Scope hint */}
        <Alert className="border-dashed" data-testid="envvar-edit-context">
          <AlertDescription className="text-xs">
            {scope === 'process'
              ? t('envvar.editDialog.processScopeHint')
              : t('envvar.editDialog.persistentScopeHint')}
          </AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!key.trim() || pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? t('common.loading') : saveLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

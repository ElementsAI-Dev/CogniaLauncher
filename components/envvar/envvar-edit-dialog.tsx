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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EnvVarScope } from '@/types/tauri';

interface EnvVarEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (key: string, value: string, scope: EnvVarScope) => void;
  editKey?: string;
  editValue?: string;
  t: (key: string) => string;
}

export function EnvVarEditDialog({
  open,
  onOpenChange,
  onSave,
  editKey,
  editValue,
  t,
}: EnvVarEditDialogProps) {
  const [key, setKey] = useState(editKey || '');
  const [value, setValue] = useState(editValue || '');
  const [scope, setScope] = useState<EnvVarScope>('process');
  const [keyError, setKeyError] = useState<string | null>(null);

  const isEdit = !!editKey;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setKey(editKey || '');
      setValue(editValue || '');
      setScope('process');
      setKeyError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      setKeyError(t('envvar.errors.keyEmpty') || 'Key cannot be empty');
      return;
    }
    if (/[\s=\0]/.test(trimmedKey)) {
      setKeyError(t('envvar.errors.keyInvalid') || 'Key contains invalid characters');
      return;
    }
    setKeyError(null);
    onSave(trimmedKey, value, scope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              onChange={(e) => {
                setKey(e.target.value);
                setKeyError(null);
              }}
              placeholder="MY_VARIABLE"
              disabled={isEdit}
              className="font-mono text-sm"
            />
            {keyError && (
              <p className="text-sm text-destructive">{keyError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="envvar-value">{t('envvar.table.value')}</Label>
            <Input
              id="envvar-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="/usr/local/bin"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="envvar-scope">{t('envvar.table.scope')}</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as EnvVarScope)}>
                <SelectTrigger id="envvar-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="process">{t('envvar.scopes.process')}</SelectItem>
                  <SelectItem value="user">{t('envvar.scopes.user')}</SelectItem>
                  <SelectItem value="system">{t('envvar.scopes.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!key.trim()}>
            {isEdit ? t('common.save') : t('envvar.actions.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

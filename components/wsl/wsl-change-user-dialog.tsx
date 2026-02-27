'use client';

import { useState, useEffect } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { UserCog, Loader2 } from 'lucide-react';
import type { WslChangeUserDialogProps } from '@/types/wsl';
import type { WslUser } from '@/types/tauri';

export function WslChangeUserDialog({
  open,
  distroName,
  onOpenChange,
  onConfirm,
  listUsers,
  t,
}: WslChangeUserDialogProps) {
  const [users, setUsers] = useState<WslUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !distroName) return;
    let cancelled = false;
    setLoadingUsers(true);
    setSelectedUser('');
    setManualInput('');
    setUseManual(false);
    listUsers(distroName)
      .then((result) => {
        if (!cancelled) {
          setUsers(result);
          setUseManual(result.length === 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
          setUseManual(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });
    return () => { cancelled = true; };
  }, [open, distroName, listUsers]);

  const username = useManual ? manualInput.trim() : selectedUser;

  const handleSubmit = async () => {
    if (!username) return;
    setSubmitting(true);
    try {
      await onConfirm(distroName, username);
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {t('wsl.changeDefaultUser')} — {distroName}
          </DialogTitle>
          <DialogDescription>{t('wsl.dialog.changeUserDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loadingUsers ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : users.length > 0 && !useManual ? (
            <div className="space-y-2">
              <Label>{t('wsl.dialog.selectUser')}</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder={t('wsl.dialog.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.uid} value={u.username}>
                      <span className="font-medium">{u.username}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        (uid:{u.uid}, {u.shell})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setUseManual(true)}
              >
                {t('wsl.dialog.manualInput')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="wsl-username-input">{t('wsl.username')}</Label>
              <Input
                id="wsl-username-input"
                placeholder="username"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && username) handleSubmit();
                }}
                autoFocus
              />
              {users.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setUseManual(false)}
                >
                  {t('wsl.dialog.selectFromList')}
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!username || submitting}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

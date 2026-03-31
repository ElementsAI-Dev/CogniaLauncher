'use client';

import { useCallback, useState } from 'react';
import { AlertCircle, ArrowRightLeft, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WslPortForwardCardProps } from '@/types/wsl';

export function WslPortForwardCard({
  rules,
  loading = false,
  stale = false,
  defaultConnectAddress,
  onRefresh,
  onAdd,
  onRemove,
  t,
}: WslPortForwardCardProps) {
  const [listenAddress, setListenAddress] = useState('0.0.0.0');
  const [listenPort, setListenPort] = useState('');
  const [connectAddress, setConnectAddress] = useState(defaultConnectAddress ?? '');
  const [connectPort, setConnectPort] = useState('');
  const [mutating, setMutating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | {
      type: 'add';
      rule: {
        listenAddress: string;
        listenPort: number;
        connectAddress: string;
        connectPort: number;
      };
    }
    | {
      type: 'remove';
      listenAddress: string;
      listenPort: number;
    }
    | null
  >(null);

  const showMutationError = useCallback((err: unknown) => {
    toast.error(t('wsl.detail.portForward.actionFailed').replace('{error}', String(err)));
  }, [t]);

  const handleAdd = useCallback(() => {
    const parsedListenPort = Number.parseInt(listenPort, 10);
    const parsedConnectPort = Number.parseInt(connectPort, 10);
    if (!listenAddress.trim() || !connectAddress.trim() || !parsedListenPort || !parsedConnectPort) {
      return;
    }

    setConfirmAction({
      type: 'add',
      rule: {
        listenAddress: listenAddress.trim(),
        listenPort: parsedListenPort,
        connectAddress: connectAddress.trim(),
        connectPort: parsedConnectPort,
      },
    });
  }, [connectAddress, connectPort, listenAddress, listenPort]);

  const handleRemove = useCallback((nextListenAddress: string, nextListenPort: string) => {
    const parsedListenPort = Number.parseInt(nextListenPort, 10);
    if (!parsedListenPort) {
      return;
    }

    setConfirmAction({
      type: 'remove',
      listenAddress: nextListenAddress,
      listenPort: parsedListenPort,
    });
  }, []);

  const confirmAndExecute = useCallback(async () => {
    if (!confirmAction) {
      return;
    }

    setMutating(true);
    try {
      if (confirmAction.type === 'add') {
        await onAdd(
          confirmAction.rule.listenAddress,
          confirmAction.rule.listenPort,
          confirmAction.rule.connectPort,
          confirmAction.rule.connectAddress,
        );
        toast.success(t('wsl.detail.portForward.added'));
        setListenAddress('0.0.0.0');
        setListenPort('');
        setConnectAddress(defaultConnectAddress ?? '');
        setConnectPort('');
      } else {
        await onRemove(confirmAction.listenAddress, confirmAction.listenPort);
        toast.success(t('wsl.detail.portForward.removed'));
      }

      await onRefresh();
    } catch (err) {
      showMutationError(err);
    } finally {
      setMutating(false);
      setConfirmAction(null);
    }
  }, [confirmAction, defaultConnectAddress, onAdd, onRefresh, onRemove, showMutationError, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          {t('wsl.detail.portForward.title')}
          {rules.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {rules.length}
            </Badge>
          )}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { void onRefresh(); }}
            className="h-8 w-8"
            disabled={loading || mutating}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('wsl.detail.portForward.desc')}</p>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('wsl.detail.portForward.elevationWarning')}
          </AlertDescription>
        </Alert>

        {stale && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t('wsl.detail.infoRetryHint')}
          </p>
        )}

        {rules.length > 0 && (
          <ScrollArea className="max-h-[220px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('wsl.detail.portForward.listenAddress')}</TableHead>
                  <TableHead>{t('wsl.detail.portForward.listenPort')}</TableHead>
                  <TableHead>{t('wsl.detail.portForward.connectAddr')}</TableHead>
                  <TableHead>{t('wsl.detail.portForward.connectPort')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={`${rule.listenAddress}-${rule.listenPort}-${rule.connectAddress}-${rule.connectPort}`}>
                    <TableCell className="font-mono text-xs">{rule.listenAddress}</TableCell>
                    <TableCell className="font-mono text-xs">{rule.listenPort}</TableCell>
                    <TableCell className="font-mono text-xs">{rule.connectAddress}</TableCell>
                    <TableCell className="font-mono text-xs">{rule.connectPort}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-label={`remove-port-forward-${rule.listenPort}-${rule.listenAddress}`}
                        onClick={() => handleRemove(rule.listenAddress, rule.listenPort)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <div className="grid gap-2 md:grid-cols-4">
          <Input
            value={listenAddress}
            onChange={(event) => setListenAddress(event.target.value)}
            placeholder="0.0.0.0"
            aria-label={t('wsl.detail.portForward.listenAddress')}
            className="text-xs"
          />
          <Input
            value={listenPort}
            onChange={(event) => setListenPort(event.target.value)}
            placeholder="3000"
            type="number"
            aria-label={t('wsl.detail.portForward.listenPort')}
            className="text-xs"
          />
          <Input
            value={connectAddress}
            onChange={(event) => setConnectAddress(event.target.value)}
            placeholder={defaultConnectAddress ?? '172.x.x.x'}
            aria-label={t('wsl.detail.portForward.connectAddr')}
            className="text-xs"
          />
          <Input
            value={connectPort}
            onChange={(event) => setConnectPort(event.target.value)}
            placeholder="3000"
            type="number"
            aria-label={t('wsl.detail.portForward.connectPort')}
            className="text-xs"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1"
          aria-label="add-port-forward-rule"
          disabled={
            mutating
            || !listenAddress.trim()
            || !listenPort.trim()
            || !connectAddress.trim()
            || !connectPort.trim()
          }
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3" />
          {t('wsl.detail.portForward.confirmAddTitle')}
        </Button>
      </CardContent>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'add'
                ? t('wsl.detail.portForward.confirmAddTitle')
                : t('wsl.detail.portForward.confirmRemoveTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'add'
                ? t('wsl.detail.portForward.confirmAddDesc')
                  .replace('{listenPort}', String(confirmAction.rule.listenPort))
                  .replace('{connectAddress}', confirmAction.rule.connectAddress)
                  .replace('{connectPort}', String(confirmAction.rule.connectPort))
                : t('wsl.detail.portForward.confirmRemoveDesc')
                  .replace('{listenPort}', String(confirmAction?.listenPort ?? ''))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void confirmAndExecute(); }}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

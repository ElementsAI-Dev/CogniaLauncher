'use client';

import { useCallback, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, CircleDot,
  FolderInput, FolderOpen, HardDrive, Link2, Loader2, Files, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type { MigrationValidation, MigrationResult } from '@/lib/tauri';
import type { CacheMigrationDialogProps, MigrationMode } from '@/types/cache';

type Step = 'configure' | 'validated' | 'migrating' | 'done';

function getStep(validation: MigrationValidation | null, migrating: boolean, result: MigrationResult | null): Step {
  if (result) return 'done';
  if (migrating) return 'migrating';
  if (validation?.isValid) return 'validated';
  return 'configure';
}

const STEPS: { key: Step; index: number }[] = [
  { key: 'configure', index: 0 },
  { key: 'validated', index: 1 },
  { key: 'migrating', index: 2 },
  { key: 'done', index: 3 },
];

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEPS.find((s) => s.key === currentStep)?.index ?? 0;
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map(({ key, index }) => (
        <div
          key={key}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            index < currentIndex
              ? 'bg-primary'
              : index === currentIndex
                ? 'bg-primary/60'
                : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}

export function CacheMigrationDialog({ open, onOpenChange, onMigrationComplete }: CacheMigrationDialogProps) {
  const { t } = useLocale();

  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<MigrationMode>('move');
  const [validation, setValidation] = useState<MigrationValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const step = getStep(validation, migrating, result);

  const handleBrowse = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const dialogModule = await import('@tauri-apps/plugin-dialog').catch(() => null);
      if (dialogModule?.open) {
        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
          title: t('cache.migrationDestination'),
        });
        if (typeof selected === 'string') {
          setDestination(selected);
          setValidation(null);
          setResult(null);
        }
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
    }
  }, [t]);

  const handleValidate = async () => {
    if (!destination.trim() || !isTauri()) return;
    setValidating(true);
    setValidation(null);
    setResult(null);
    try {
      const { cacheMigrationValidate } = await import('@/lib/tauri');
      const v = await cacheMigrationValidate(destination.trim());
      setValidation(v);
    } catch (e) {
      toast.error(t('cache.migrationFailed', { error: String(e) }));
    } finally {
      setValidating(false);
    }
  };

  const handleMigrate = async () => {
    if (!destination.trim() || !isTauri() || !validation?.isValid) return;
    setMigrating(true);
    try {
      const { cacheMigrate } = await import('@/lib/tauri');
      const r = await cacheMigrate(destination.trim(), mode);
      setResult(r);
      if (r.success) {
        toast.success(t('cache.migrationSuccess', { size: r.bytesMigratedHuman, count: r.filesCount }));
        onMigrationComplete?.();
      } else {
        toast.error(t('cache.migrationFailed', { error: r.error || 'Unknown error' }));
      }
    } catch (e) {
      toast.error(t('cache.migrationFailed', { error: String(e) }));
    } finally {
      setMigrating(false);
    }
  };

  const handleClose = () => {
    if (!migrating) {
      setValidation(null);
      setResult(null);
      setDestination('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-primary" />
            {t('cache.migration')}
          </DialogTitle>
          <DialogDescription>{t('cache.migrationDesc')}</DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} />

        <div className="space-y-3">
          {/* Destination Path */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('cache.migrationDestination')}</Label>
            <div className="flex gap-1.5">
              <Input
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setValidation(null);
                  setResult(null);
                }}
                placeholder={t('cache.enterNewPath')}
                disabled={migrating}
                className="h-9 text-sm font-mono"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBrowse}
                    disabled={migrating}
                    className="h-9 w-9 shrink-0"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('cache.enterNewPath')}</TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={!destination.trim() || validating || migrating}
                className="h-9 shrink-0"
              >
                {validating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t('cache.migrationValidate')
                )}
              </Button>
            </div>
          </div>

          {/* Migration Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('cache.migrationMode')}</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as MigrationMode)}
              disabled={migrating}
              className="gap-1.5"
            >
              <label
                htmlFor="mode-move"
                className={cn(
                  'flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors',
                  mode === 'move' ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <RadioGroupItem value="move" id="mode-move" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium leading-none">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('cache.migrationModeMove')}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{t('cache.migrationModeMoveDesc')}</p>
                </div>
              </label>
              <label
                htmlFor="mode-link"
                className={cn(
                  'flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors',
                  mode === 'move_and_link' ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <RadioGroupItem value="move_and_link" id="mode-link" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium leading-none">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('cache.migrationModeMoveAndLink')}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{t('cache.migrationModeMoveAndLinkDesc')}</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Validation Results */}
          {validation && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t('cache.migrationSourceSize')}</span>
                  <span className="ml-auto font-medium tabular-nums">{validation.sourceSizeHuman}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Files className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t('cache.migrationSourceFiles')}</span>
                  <span className="ml-auto font-medium tabular-nums">{validation.sourceFileCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t('cache.migrationDestSpace')}</span>
                  <span className="ml-auto font-medium tabular-nums">{validation.destinationSpaceHuman}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t('cache.migrationSameDrive')}</span>
                  <span className="ml-auto font-medium">{validation.isSameDrive ? t('cache.yes') : t('cache.no')}</span>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <Alert variant="destructive" className="py-2">
                  <X className="h-4 w-4" />
                  <AlertTitle className="text-sm">{t('cache.migrationErrors')}</AlertTitle>
                  <AlertDescription className="text-xs">
                    {validation.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {validation.warnings.length > 0 && (
                <Alert className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">{t('cache.migrationWarnings')}</AlertTitle>
                  <AlertDescription className="text-xs">
                    {validation.warnings.map((warn, i) => (
                      <p key={i}>{warn}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {validation.isValid && (
                <Badge variant="default" className="gap-1 text-xs">
                  <Check className="h-3 w-3" /> {t('cache.readyToMigrate')}
                </Badge>
              )}
            </div>
          )}

          {/* Migration Progress */}
          {migrating && (
            <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {t('cache.migrationMigrating')}
              </div>
              <Progress className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {mode === 'move_and_link'
                  ? t('cache.migrationModeMoveAndLinkDesc')
                  : t('cache.migrationModeMoveDesc')}
              </p>
            </div>
          )}

          {/* Migration Result */}
          {result && (
            result.success ? (
              <Alert className="border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-sm">
                  {t('cache.migrationSuccess', { size: result.bytesMigratedHuman, count: result.filesCount })}
                </AlertTitle>
                {result.symlinkCreated && (
                  <AlertDescription className="text-xs">
                    {t('cache.migrationSymlinkCreated')}
                  </AlertDescription>
                )}
              </Alert>
            ) : (
              <Alert variant="destructive" className="py-2">
                <X className="h-4 w-4" />
                <AlertTitle className="text-sm">{t('cache.migrationFailed', { error: '' })}</AlertTitle>
                <AlertDescription className="text-xs">{result.error}</AlertDescription>
              </Alert>
            )
          )}
        </div>

        <DialogFooter className="pt-0 gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={migrating}>
            {result?.success ? t('common.done') : t('common.cancel')}
          </Button>
          {!result?.success && (
            <Button
              size="sm"
              onClick={handleMigrate}
              disabled={!validation?.isValid || migrating}
            >
              {migrating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {t('cache.migrationMigrating')}
                </>
              ) : (
                t('cache.migrationStart')
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

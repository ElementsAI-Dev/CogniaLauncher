'use client';

import { useState } from 'react';
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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, FolderInput, Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type { MigrationValidation, MigrationResult } from '@/lib/tauri';
import type { CacheMigrationDialogProps } from '@/types/cache';

export function CacheMigrationDialog({ open, onOpenChange, onMigrationComplete }: CacheMigrationDialogProps) {
  const { t } = useLocale();

  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<'move' | 'move_and_link'>('move');
  const [validation, setValidation] = useState<MigrationValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            {t('cache.migration')}
          </DialogTitle>
          <DialogDescription>{t('cache.migrationDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Destination Path */}
          <div className="space-y-2">
            <Label>{t('cache.migrationDestination')}</Label>
            <div className="flex gap-2">
              <Input
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setValidation(null);
                  setResult(null);
                }}
                placeholder={t('cache.enterNewPath')}
                disabled={migrating}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleValidate}
                    disabled={!destination.trim() || validating || migrating}
                  >
                    {validating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t('cache.migrationValidate')
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('cache.migrationValidate')}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Migration Mode */}
          <div className="space-y-2">
            <Label>{t('cache.migrationMode')}</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as 'move' | 'move_and_link')}
              disabled={migrating}
            >
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="move" id="mode-move" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-move" className="flex items-center gap-2 cursor-pointer">
                    <ArrowRight className="h-4 w-4" />
                    {t('cache.migrationModeMove')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">{t('cache.migrationModeMoveDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="move_and_link" id="mode-link" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-link" className="flex items-center gap-2 cursor-pointer">
                    <Link2 className="h-4 w-4" />
                    {t('cache.migrationModeMoveAndLink')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">{t('cache.migrationModeMoveAndLinkDesc')}</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Validation Results */}
          {validation && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('cache.migrationSourceSize')}</span>
                  <p className="font-medium">{validation.sourceSizeHuman}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('cache.migrationSourceFiles')}</span>
                  <p className="font-medium">{validation.sourceFileCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('cache.migrationDestSpace')}</span>
                  <p className="font-medium">{validation.destinationSpaceHuman}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('cache.migrationSameDrive')}</span>
                  <p className="font-medium">{validation.isSameDrive ? t('cache.yes') : t('cache.no')}</p>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <Alert variant="destructive">
                  <X className="h-4 w-4" />
                  <AlertTitle>{t('cache.migrationErrors')}</AlertTitle>
                  <AlertDescription>
                    {validation.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {validation.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('cache.migrationWarnings')}</AlertTitle>
                  <AlertDescription>
                    {validation.warnings.map((warn, i) => (
                      <p key={i}>{warn}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {validation.isValid && (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" /> {t('cache.readyToMigrate')}
                </Badge>
              )}
            </div>
          )}

          {/* Migration Result */}
          {result && (
            result.success ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>
                  {t('cache.migrationSuccess', { size: result.bytesMigratedHuman, count: result.filesCount })}
                </AlertTitle>
                {result.symlinkCreated && (
                  <AlertDescription>
                    {t('cache.migrationSymlinkCreated')}
                  </AlertDescription>
                )}
              </Alert>
            ) : (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertTitle>{t('cache.migrationFailed', { error: '' })}</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={migrating}>
            {result?.success ? t('common.done') : t('common.cancel')}
          </Button>
          {!result?.success && (
            <Button
              onClick={handleMigrate}
              disabled={!validation?.isValid || migrating}
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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

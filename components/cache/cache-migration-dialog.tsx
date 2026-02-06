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
import { AlertTriangle, ArrowRight, Check, FolderInput, Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri';
import type { MigrationValidation, MigrationResult } from '@/lib/tauri';

interface CacheMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrationComplete?: () => void;
}

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
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1">
                    <X className="h-4 w-4" /> {t('cache.migrationErrors')}
                  </p>
                  {validation.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive pl-5">{err}</p>
                  ))}
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> {t('cache.migrationWarnings')}
                  </p>
                  {validation.warnings.map((warn, i) => (
                    <p key={i} className="text-xs text-yellow-600 dark:text-yellow-500 pl-5">{warn}</p>
                  ))}
                </div>
              )}

              {validation.isValid && (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" /> Ready to migrate
                </Badge>
              )}
            </div>
          )}

          {/* Migration Result */}
          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
              {result.success ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    {t('cache.migrationSuccess', { size: result.bytesMigratedHuman, count: result.filesCount })}
                  </p>
                  {result.symlinkCreated && (
                    <p className="text-xs text-green-600 dark:text-green-500 pl-5">
                      {t('cache.migrationSymlinkCreated')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-destructive">{result.error}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={migrating}>
            {result?.success ? 'Done' : 'Cancel'}
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

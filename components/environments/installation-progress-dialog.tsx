'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/components/providers/locale-provider';
import { useEnvironmentStore, type InstallationProgress } from '@/lib/stores/environment';
import { useEnvironments } from '@/lib/hooks/use-environments';
import { cn } from '@/lib/utils';
import { Download, Check, Loader2, AlertCircle, Minimize2 } from 'lucide-react';

const STEP_LABELS: Record<InstallationProgress['step'], string> = {
  fetching: 'progress.fetchingInfo',
  downloading: 'progress.downloadingBinaries',
  extracting: 'progress.extracting',
  configuring: 'progress.configuring',
  done: 'progress.configuring',
  error: 'progress.configuring',
};

const STEPS: InstallationProgress['step'][] = ['fetching', 'downloading', 'extracting', 'configuring'];

export function InstallationProgressDialog() {
  const { t } = useLocale();
  const { progressDialogOpen, installationProgress, closeProgressDialog } = useEnvironmentStore();
  const { cancelInstallation } = useEnvironments();

  if (!installationProgress) return null;

  const { envType, version, provider, step, progress, error, downloadedSize, totalSize, speed } = installationProgress;

  const getStepStatus = (s: InstallationProgress['step']) => {
    const stepIndex = STEPS.indexOf(s);
    const currentIndex = STEPS.indexOf(step);
    
    if (step === 'error') return 'error';
    if (step === 'done') return 'completed';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-3 w-3 text-white" />;
      case 'active':
        return <Loader2 className="h-3 w-3 text-white animate-spin" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-white" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-current" />;
    }
  };

  return (
    <Dialog open={progressDialogOpen} onOpenChange={(open) => !open && step === 'done' && closeProgressDialog()}>
      <DialogContent className="sm:max-w-[480px]" showCloseButton={step === 'done' || step === 'error'}>
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Download className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {t('environments.progress.title', { name: envType })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('environments.progress.subtitle', { version, provider })}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="py-6 space-y-5">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {step === 'error' ? error : t(`environments.${STEP_LABELS[step]}`)}
              </span>
              <span className={cn(
                "text-sm font-semibold font-mono",
                step === 'error' ? 'text-destructive' : 'text-green-600'
              )}>
                {step === 'error' ? 'Error' : `${progress}%`}
              </span>
            </div>
            <Progress 
              value={progress} 
              className={cn("h-2", step === 'error' && "bg-destructive/20")}
            />
            {step === 'downloading' && downloadedSize && totalSize && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{downloadedSize} / {totalSize}</span>
                {speed && <span>{speed}</span>}
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('environments.progress.steps')}
            </span>
            <div className="space-y-2">
              {STEPS.map((s, index) => {
                const status = getStepStatus(s);
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full",
                      status === 'completed' && "bg-green-600",
                      status === 'active' && "bg-green-600",
                      status === 'error' && "bg-destructive",
                      status === 'pending' && "bg-muted"
                    )}>
                      {getStepIcon(status)}
                    </div>
                    <span className={cn(
                      "text-sm",
                      status === 'active' && "font-medium",
                      status === 'pending' && "text-muted-foreground",
                      status === 'error' && "text-destructive"
                    )}>
                      {t(`environments.${STEP_LABELS[STEPS[index]]}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {step === 'error' && error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'error' || step === 'done' ? (
            <Button onClick={closeProgressDialog}>
              {t('common.close')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={cancelInstallation}>
                {t('environments.progress.cancel')}
              </Button>
              <Button variant="secondary" className="gap-2" onClick={closeProgressDialog}>
                <Minimize2 className="h-4 w-4" />
                {t('environments.progress.runInBackground')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Download, Trash2, RefreshCw, AlertCircle, CheckCircle, 
  XCircle, Loader2, Package, ChevronDown, ChevronRight,
  Clock, AlertTriangle, Info
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { BatchResult } from '@/lib/tauri';

interface BatchOperationsProps {
  selectedPackages: string[];
  onBatchInstall: (packages: string[], options?: { dryRun?: boolean; force?: boolean }) => Promise<BatchResult>;
  onBatchUninstall: (packages: string[], force?: boolean) => Promise<BatchResult>;
  onBatchUpdate: (packages?: string[]) => Promise<BatchResult>;
  onClearSelection: () => void;
}

type OperationType = 'install' | 'uninstall' | 'update';

export function BatchOperations({
  selectedPackages,
  onBatchInstall,
  onBatchUninstall,
  onBatchUpdate,
  onClearSelection,
}: BatchOperationsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>('install');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [force, setForce] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { t } = useLocale();

  const handleOperation = useCallback(async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      let batchResult: BatchResult;
      
      switch (operationType) {
        case 'install':
          batchResult = await onBatchInstall(selectedPackages, { dryRun, force });
          break;
        case 'uninstall':
          batchResult = await onBatchUninstall(selectedPackages, force);
          break;
        case 'update':
          batchResult = await onBatchUpdate(selectedPackages.length > 0 ? selectedPackages : undefined);
          break;
        default:
          throw new Error('Unknown operation');
      }

      setResult(batchResult);
      
      // Clear selection on successful completion (if not dry run)
      if (!dryRun && batchResult.failed.length === 0) {
        onClearSelection();
      }
    } catch (error) {
      // Handle error
      console.error('Batch operation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [operationType, selectedPackages, dryRun, force, onBatchInstall, onBatchUninstall, onBatchUpdate, onClearSelection]);

  const openDialog = useCallback((type: OperationType) => {
    setOperationType(type);
    setResult(null);
    setDryRun(false);
    setForce(false);
    setShowDetails(false);
    setIsDialogOpen(true);
  }, []);

  const getOperationLabel = () => {
    switch (operationType) {
      case 'install': return t('common.install');
      case 'uninstall': return t('common.uninstall');
      case 'update': return t('common.update');
    }
  };

  const getOperationIcon = () => {
    switch (operationType) {
      case 'install': return <Download className="h-4 w-4" />;
      case 'uninstall': return <Trash2 className="h-4 w-4" />;
      case 'update': return <RefreshCw className="h-4 w-4" />;
    }
  };

  if (selectedPackages.length === 0 && operationType !== 'update') {
    return null;
  }

  return (
    <>
      {/* Floating Action Bar */}
      {selectedPackages.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-lg shadow-lg p-3 flex items-center gap-4 z-50">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{t('packages.selected', { count: selectedPackages.length })}</span>
          </div>
          
          <div className="h-6 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="default"
              onClick={() => openDialog('install')}
            >
              <Download className="h-4 w-4 mr-1" />
              {t('common.install')}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => openDialog('update')}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('common.update')}
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => openDialog('uninstall')}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('common.uninstall')}
            </Button>
          </div>
          
          <div className="h-6 w-px bg-border" />
          
          <Button 
            size="sm" 
            variant="ghost"
            onClick={onClearSelection}
          >
            {t('common.clear')}
          </Button>
        </div>
      )}

      {/* Operation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getOperationIcon()}
              {getOperationLabel()} Packages
            </DialogTitle>
            <DialogDescription>
              {result 
                ? t('packages.batchCompleted', { time: (result.total_time_ms / 1000).toFixed(2) })
                : t('packages.batchDescription', { action: getOperationLabel(), count: selectedPackages.length })
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Package List */}
            {!result && selectedPackages.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">{t('packages.packagesLabel')}:</div>
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  <div className="space-y-1">
                    {selectedPackages.map((pkg) => (
                      <div 
                        key={pkg} 
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent"
                      >
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{pkg}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Options */}
            {!result && !isProcessing && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="dryRun" 
                    checked={dryRun}
                    onCheckedChange={(checked) => setDryRun(checked === true)}
                  />
                  <label htmlFor="dryRun" className="text-sm cursor-pointer">
                    {t('packages.dryRun')}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="force" 
                    checked={force}
                    onCheckedChange={(checked) => setForce(checked === true)}
                  />
                  <label htmlFor="force" className="text-sm cursor-pointer">
                    {t('packages.forceOption')}
                  </label>
                </div>
              </div>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="space-y-4 py-8">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="text-center">
                    <div className="font-medium">{t('packages.processing')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('packages.processingDesc')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-green-600">
                      {result.successful.length}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('packages.successful')}</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                    <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-red-600">
                      {result.failed.length}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('packages.failed')}</div>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                    <Clock className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-yellow-600">
                      {result.skipped.length}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('packages.skipped')}</div>
                  </div>
                </div>

                {/* Details Toggle */}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {showDetails ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {t('packages.showDetails')}
                </button>

                {/* Detailed Results */}
                {showDetails && (
                  <ScrollArea className="h-[200px] border rounded-md">
                    <div className="p-2 space-y-2">
                      {/* Successful */}
                      {result.successful.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-green-500/5">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="flex-1 text-sm">{item.name}</span>
                          <Badge variant="secondary">{item.version}</Badge>
                          <Badge variant="outline">{item.action}</Badge>
                        </div>
                      ))}
                      
                      {/* Failed */}
                      {result.failed.map((item, i) => (
                        <div key={i} className="p-2 rounded bg-red-500/5 space-y-1">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="flex-1 text-sm font-medium">{item.name}</span>
                            {item.recoverable && (
                              <Badge variant="outline">{t('packages.retryPossible')}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-red-500 ml-6">{item.error}</div>
                          {item.suggestion && (
                            <div className="text-xs text-muted-foreground ml-6 flex items-center gap-1">
                              <Info className="h-3 w-3" />
                              {item.suggestion}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Skipped */}
                      {result.skipped.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-yellow-500/5">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          <span className="flex-1 text-sm">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Retry Failed Button */}
                {result.failed.length > 0 && result.failed.some(f => f.recoverable) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('packages.someOperationsFailed')}</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        {t('packages.operationsCanRetry', { count: result.failed.filter(f => f.recoverable).length })}
                      </span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          onClearSelection();
                        }}
                      >
                        {t('packages.retryFailed')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {!result && !isProcessing && (
              <>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleOperation}>
                  {getOperationIcon()}
                  <span className="ml-2">
                    {dryRun ? t('packages.preview') : getOperationLabel()}
                  </span>
                </Button>
              </>
            )}
            {(result || isProcessing) && (
              <Button onClick={() => setIsDialogOpen(false)}>
                {result ? t('packages.done') : t('common.cancel')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

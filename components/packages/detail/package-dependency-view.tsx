'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  Package,
  ChevronRight,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useLocale } from '@/components/providers/locale-provider';
import { formatSize } from '@/lib/utils';
import type { PackageDependencyViewProps } from '@/types/packages';

export function PackageDependencyView({
  resolution,
  loading,
  onResolve,
}: PackageDependencyViewProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              {t('packages.detail.dependencyAnalysis')}
            </CardTitle>
            <CardDescription>{t('packages.detail.dependencyAnalysisDesc')}</CardDescription>
          </div>
          <Button onClick={onResolve} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4 mr-2" />
            )}
            {loading ? t('packages.detail.analyzing') : t('packages.detail.analyzeDependencies')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading state */}
        {loading && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t('packages.resolvingDependencies')}
            </div>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 ml-4" style={{ width: `${100 - i * 15}%` }} />
            ))}
          </div>
        )}

        {/* Resolution result */}
        {resolution && !loading && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold">{resolution.total_packages}</div>
                  <div className="text-xs text-muted-foreground">{t('packages.detail.totalDependencies')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {resolution.tree.filter((n) => n.is_installed).length}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('packages.installed')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {resolution.tree.filter((n) => !n.is_installed).length}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('packages.toInstall')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-destructive">{resolution.conflicts.length}</div>
                  <div className="text-xs text-muted-foreground">{t('packages.detail.conflictsFound')}</div>
                </CardContent>
              </Card>
            </div>

            {/* Status banner */}
            {resolution.success ? (
              <Alert className="bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400 [&>svg]:text-green-600">
                <Check className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{t('packages.resolutionSuccessful')}</span>
                  {resolution.total_size != null && resolution.total_size > 0 && (
                    <span className="text-sm">
                      {t('packages.totalDownload')} {formatSize(resolution.total_size)}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t('packages.resolutionFailed')}</AlertDescription>
              </Alert>
            )}

            {/* Conflicts */}
            {resolution.conflicts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  {t('packages.dependencyConflicts')}
                </h4>
                {resolution.conflicts.map((conflict, i) => (
                  <div key={i} className="p-3 border border-destructive/30 bg-destructive/5 rounded-lg">
                    <div className="font-medium">{conflict.package_name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('packages.requiredVersions')} {conflict.versions.join(', ')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('packages.requiredBy')} {conflict.required_by.join(', ')}
                    </div>
                    {conflict.resolution && (
                      <div className="text-sm text-primary mt-2">
                        {t('packages.suggestion')} {conflict.resolution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dependency list */}
            {resolution.tree.length > 0 && (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-1 border rounded-lg p-3">
                  {resolution.tree.map((node, i) => (
                    <div
                      key={`${node.name}-${i}`}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50"
                    >
                      <Package className={`h-4 w-4 ${node.is_conflict ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <span className={`font-medium text-sm ${node.is_conflict ? 'text-destructive' : ''}`}>
                        {node.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">{node.version}</Badge>
                      {node.provider && <Badge variant="outline" className="text-xs">{node.provider}</Badge>}
                      {node.is_installed ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Badge variant="default" className="text-xs">{t('packages.toInstall')}</Badge>
                      )}
                      {node.is_conflict && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {t('packages.conflict')}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Install order */}
            {resolution.install_order.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  {t('packages.installationOrder')}
                </h4>
                <div className="flex flex-wrap items-center gap-1">
                  {resolution.install_order.map((pkg, i) => (
                    <div key={pkg} className="flex items-center">
                      <Badge variant="outline">{pkg}</Badge>
                      {i < resolution.install_order.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!resolution && !loading && (
          <Empty className="border-none py-12">
            <EmptyHeader>
              <EmptyMedia>
                <Layers className="h-12 w-12 opacity-50" />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t('packages.detail.noDependencies')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

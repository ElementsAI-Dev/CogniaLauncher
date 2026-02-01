'use client';

import { useEffect } from 'react';
import { EnvironmentCard } from '@/components/environments/environment-card';
import { AddEnvironmentDialog } from '@/components/environments/add-environment-dialog';
import { InstallationProgressDialog } from '@/components/environments/installation-progress-dialog';
import { useEnvironments } from '@/lib/hooks/use-environments';
import { useLocale } from '@/components/providers/locale-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Plus } from 'lucide-react';

export default function EnvironmentsPage() {
  const {
    environments,
    detectedVersions,
    loading,
    error,
    fetchEnvironments,
    installVersion,
    uninstallVersion,
    setGlobalVersion,
    setLocalVersion,
    detectVersions,
    openAddDialog,
  } = useEnvironments();
  const { t } = useLocale();

  useEffect(() => {
    fetchEnvironments();
    detectVersions('.');
  }, [fetchEnvironments, detectVersions]);

  const getDetectedForEnv = (envType: string) => {
    return detectedVersions.find((d) => d.env_type === envType) || null;
  };

  const handleRefresh = async () => {
    await fetchEnvironments();
    await detectVersions('.');
  };

  const handleAddEnvironment = async (language: string, provider: string, version: string) => {
    await installVersion(language, version);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('environments.title')}</h1>
          <p className="text-muted-foreground">{t('environments.description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('environments.refresh')}
          </Button>
          <Button size="sm" onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('environments.addEnvironment')}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && environments.length === 0 ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : environments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">{t('environments.noEnvironments')}</p>
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('environments.addEnvironment')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {environments.map((env) => (
            <EnvironmentCard
              key={env.env_type}
              env={env}
              detectedVersion={getDetectedForEnv(env.env_type)}
              onInstall={async (version) => {
                await installVersion(env.env_type, version);
              }}
              onUninstall={async (version) => {
                await uninstallVersion(env.env_type, version);
              }}
              onSetGlobal={async (version) => {
                await setGlobalVersion(env.env_type, version);
              }}
              onSetLocal={async (version, projectPath) => {
                await setLocalVersion(env.env_type, version, projectPath);
              }}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddEnvironmentDialog onAdd={handleAddEnvironment} />
      <InstallationProgressDialog />
    </div>
  );
}

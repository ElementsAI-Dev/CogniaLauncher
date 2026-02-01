'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/components/providers/locale-provider';
import * as tauri from '@/lib/tauri';
import { AlertCircle, Download, Check, ExternalLink, Github, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AboutPage() {
  const { t } = useLocale();
  const [updateInfo, setUpdateInfo] = useState<tauri.SelfUpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await tauri.selfCheckUpdate();
      setUpdateInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await tauri.selfUpdate();
      toast.success('Update started! The application will restart shortly.');
    } catch (err) {
      toast.error(`Update failed: ${err}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t('about.title')} {t('common.appName')}</h1>
        <p className="text-muted-foreground">{t('about.description')}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('about.version')}</CardTitle>
            <CardDescription>{t('about.crossPlatform')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono">
                  v{updateInfo?.current_version || t('common.unknown')}
                </span>
                {updateInfo?.update_available === false && (
                  <Badge variant="secondary" className="text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    {t('common.update')}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('about.version')}</CardTitle>
            <CardDescription>{t('about.crossPlatform')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : updateInfo?.latest_version ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono">
                  v{updateInfo.latest_version}
                </span>
                {updateInfo.update_available && (
                  <Badge variant="default" className="bg-blue-500">
                    <Download className="h-3 w-3 mr-1" />
                    {t('common.update')}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{t('common.unknown')}</span>
            )}
          </CardContent>
        </Card>
      </div>

      {updateInfo?.update_available && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('common.update')}
            </CardTitle>
            <CardDescription>
              {t('about.crossPlatform')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {updateInfo.release_notes && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h4 className="text-sm font-medium mb-2">{t('about.version')}</h4>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-background p-3 rounded border">
                  {updateInfo.release_notes}
                </div>
              </div>
            )}
            <Button onClick={handleUpdate} disabled={updating}>
              <Download className="h-4 w-4 mr-2" />
              {updating ? t('common.loading') : t('common.update')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('common.update')}</CardTitle>
          <CardDescription>{t('about.crossPlatform')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={checkForUpdate} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t('common.loading') : t('common.refresh')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{t('about.title')}</CardTitle>
          <CardDescription>{t('common.appName')} - {t('about.crossPlatform')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('about.crossPlatform')}
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://github.com/CogniaLauncher/CogniaLauncher"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://cognia.dev/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Documentation
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

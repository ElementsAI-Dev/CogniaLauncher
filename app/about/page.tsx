'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import * as tauri from '@/lib/tauri';
import {
  AlertCircle,
  Download,
  Check,
  BookOpen,
  Github,
  RefreshCw,
  Package,
  CloudDownload,
  Monitor,
  Blocks,
  Scale,
  ShieldCheck,
  Copyright,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemInfo {
  os: string;
  arch: string;
  homeDir: string;
  locale: string;
}

interface BuildDependency {
  name: string;
  version: string;
  color: string;
  textColor: string;
  letter: string;
}

const BUILD_DEPENDENCIES: BuildDependency[] = [
  { name: 'Tauri', version: 'v2.9.0', color: '#FFC131', textColor: '#000000', letter: 'T' },
  { name: 'Rust', version: 'v1.77.2', color: '#DEA584', textColor: '#000000', letter: 'R' },
  { name: 'Next.js', version: 'v16.0.0', color: '#000000', textColor: '#FFFFFF', letter: 'N' },
  { name: 'React', version: 'v19.0.0', color: '#61DAFB', textColor: '#000000', letter: '⚛' },
];

export default function AboutPage() {
  const { t, locale } = useLocale();
  const [updateInfo, setUpdateInfo] = useState<tauri.SelfUpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemLoading, setSystemLoading] = useState(true);

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

  const loadSystemInfo = useCallback(async () => {
    setSystemLoading(true);
    try {
      const [platformInfo, cogniaDir] = await Promise.all([
        tauri.getPlatformInfo(),
        tauri.getCogniaDir(),
      ]);
      setSystemInfo({
        os: platformInfo.os,
        arch: platformInfo.arch,
        homeDir: cogniaDir,
        locale: locale === 'zh' ? 'zh-CN' : 'en-US',
      });
    } catch (err) {
      console.error('Failed to load system info:', err);
      setSystemInfo({
        os: 'Unknown',
        arch: 'Unknown',
        homeDir: '~/.cognia',
        locale: locale === 'zh' ? 'zh-CN' : 'en-US',
      });
    } finally {
      setSystemLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    checkForUpdate();
    loadSystemInfo();
  }, [checkForUpdate, loadSystemInfo]);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await tauri.selfUpdate();
      toast.success(t('about.updateStarted') || 'Update started! The application will restart shortly.');
    } catch (err) {
      toast.error(`${t('common.error')}: ${err}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-[28px] font-bold text-foreground">{t('about.pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('about.pageDescription')}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Version Cards Row */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Current Version Card */}
        <Card className="rounded-xl border bg-card">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-foreground">{t('about.currentVersion')}</span>
            </div>
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                <span className="text-[32px] font-bold text-foreground">
                  v{updateInfo?.current_version || '0.1.0'}
                </span>
                {updateInfo?.update_available === false && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      {t('about.upToDate')}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Latest Version Card */}
        <Card className="rounded-xl border bg-card">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CloudDownload className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-foreground">{t('about.latestVersion')}</span>
            </div>
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                <span className="text-[32px] font-bold text-foreground">
                  v{updateInfo?.latest_version || updateInfo?.current_version || '0.1.0'}
                </span>
                {updateInfo?.latest_version && (
                  <span className="text-xs text-muted-foreground">
                    {t('about.latestVersion')}
                  </span>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Update Available Banner */}
      {updateInfo?.update_available && (
        <Card className="rounded-xl border-blue-200 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                {t('about.updateAvailable')}
              </span>
            </div>
            {updateInfo.release_notes && (
              <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                {updateInfo.release_notes}
              </div>
            )}
            <Button onClick={handleUpdate} disabled={updating} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              {updating ? t('common.loading') : t('common.update')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* System Information Card */}
      <Card className="rounded-xl border bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-foreground" />
            <span className="text-base font-semibold text-foreground">{t('about.systemInfo')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground">{t('about.operatingSystem')}</span>
                {systemLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <span className="text-[13px] font-medium text-foreground">{systemInfo?.os}</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground">{t('about.architecture')}</span>
                {systemLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-[13px] font-medium text-foreground">{systemInfo?.arch}</span>
                )}
              </div>
            </div>
            {/* Column 2 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground">{t('about.homeDirectory')}</span>
                {systemLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <span className="text-[13px] font-medium text-foreground font-mono">
                    {systemInfo?.homeDir}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground">{t('about.locale')}</span>
                {systemLoading ? (
                  <Skeleton className="h-4 w-12" />
                ) : (
                  <span className="text-[13px] font-medium text-foreground">{systemInfo?.locale}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Build Dependencies Card */}
      <Card className="rounded-xl border bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Blocks className="h-5 w-5 text-foreground" />
            <span className="text-base font-semibold text-foreground">{t('about.buildDependencies')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1 */}
            <div className="space-y-2">
              {BUILD_DEPENDENCIES.slice(0, 2).map((dep) => (
                <div
                  key={dep.name}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                >
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
                    style={{ backgroundColor: dep.color, color: dep.textColor }}
                  >
                    {dep.letter}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-foreground">{dep.name}</span>
                    <span className="text-[11px] text-muted-foreground">{dep.version}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Column 2 */}
            <div className="space-y-2">
              {BUILD_DEPENDENCIES.slice(2, 4).map((dep) => (
                <div
                  key={dep.name}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                >
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
                    style={{ backgroundColor: dep.color, color: dep.textColor }}
                  >
                    {dep.letter}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-foreground">{dep.name}</span>
                    <span className="text-[11px] text-muted-foreground">{dep.version}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* License & Certificates Card */}
      <Card className="rounded-xl border bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-foreground" />
            <span className="text-base font-semibold text-foreground">{t('about.licenseCertificates')}</span>
          </div>
          <div className="space-y-3">
            {/* MIT License Row */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  {t('about.mitLicense')}
                </span>
                <span className="text-xs text-green-700 dark:text-green-300">
                  {t('about.mitLicenseDesc')}
                </span>
              </div>
            </div>
            {/* Copyright Row */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <Copyright className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t('about.copyright')}</span>
                <span className="text-xs text-muted-foreground">{t('about.copyrightDesc')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card className="rounded-xl border bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-foreground" />
            <span className="text-base font-semibold text-foreground">{t('about.actions')}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={checkForUpdate}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('about.checkForUpdates')}
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://github.com/ElementAstro/CogniaLauncher"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://cognia.dev/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                {t('about.documentation')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

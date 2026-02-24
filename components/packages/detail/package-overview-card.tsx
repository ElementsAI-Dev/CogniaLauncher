'use client';

import { writeClipboard } from '@/lib/clipboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Download,
  Trash2,
  Pin,
  Star,
  Globe,
  FileCode,
  Scale,
  ExternalLink,
  Copy,
  ArrowUp,
  Loader2,
  Calendar,
  FolderOpen,
  Server,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type { PackageInfo, InstalledPackage } from '@/lib/tauri';

interface PackageOverviewCardProps {
  packageInfo: PackageInfo | null;
  installedPkg: InstalledPackage | null;
  isInstalled: boolean;
  isPinned: boolean;
  isBookmarked: boolean;
  isInstalling: boolean;
  hasUpdate: boolean;
  latestVersion: string | null;
  onInstall: (version?: string) => Promise<void>;
  onUninstall: () => Promise<void>;
  onPin: () => Promise<void>;
  onUnpin: () => Promise<void>;
  onBookmark: () => void;
  onRollback: (version: string) => Promise<void>;
}

export function PackageOverviewCard({
  packageInfo,
  installedPkg,
  isInstalled,
  isPinned,
  isBookmarked,
  isInstalling,
  hasUpdate,
  latestVersion,
  onInstall,
  onUninstall,
  onPin,
  onUnpin,
  onBookmark,
}: PackageOverviewCardProps) {
  const { t } = useLocale();

  const handleCopyName = () => {
    if (packageInfo?.name) {
      writeClipboard(packageInfo.name);
      toast.success(t('packages.detail.copiedToClipboard'));
    }
  };

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      {/* Left column: Info + Description */}
      <div className="lg:col-span-2 space-y-4">
        {/* Description card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('packages.detail.description')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {packageInfo?.description || t('packages.detail.noDescription')}
            </p>
          </CardContent>
        </Card>

        {/* Information card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('packages.detail.information')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Provider */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Server className="h-4 w-4" />
                {t('packages.detail.provider')}
              </div>
              <Badge variant="secondary">{packageInfo?.provider || '—'}</Badge>
            </div>
            <Separator />

            {/* License */}
            {packageInfo?.license && (
              <>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Scale className="h-4 w-4" />
                    {t('packages.detail.license')}
                  </div>
                  <span className="text-sm font-medium">{packageInfo.license}</span>
                </div>
                <Separator />
              </>
            )}

            {/* Latest version */}
            {latestVersion && (
              <>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowUp className="h-4 w-4" />
                    {t('packages.detail.latestVersion')}
                  </div>
                  <Badge variant="outline" className="font-mono">{latestVersion}</Badge>
                </div>
                <Separator />
              </>
            )}

            {/* Current version (if installed) */}
            {isInstalled && installedPkg && (
              <>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    {t('packages.detail.currentVersion')}
                  </div>
                  <Badge variant="default" className="font-mono">{installedPkg.version}</Badge>
                </div>
                <Separator />
              </>
            )}

            {/* Installed at */}
            {isInstalled && installedPkg?.installed_at && (
              <>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {t('packages.detail.installedAt')}
                  </div>
                  <span className="text-sm">{new Date(installedPkg.installed_at).toLocaleString()}</span>
                </div>
                <Separator />
              </>
            )}

            {/* Install path */}
            {isInstalled && installedPkg?.install_path && installedPkg.install_path !== '' && (
              <>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FolderOpen className="h-4 w-4" />
                    {t('packages.detail.installPath')}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[300px]" title={installedPkg.install_path}>
                    {installedPkg.install_path}
                  </span>
                </div>
                <Separator />
              </>
            )}

            {/* Global / Local */}
            {isInstalled && installedPkg && (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  {t('packages.detail.installPath')}
                </div>
                <Badge variant="outline">
                  {installedPkg.is_global ? t('packages.detail.globalPackage') : t('packages.detail.localPackage')}
                </Badge>
              </div>
            )}

            {/* Links */}
            {(packageInfo?.homepage || packageInfo?.repository) && (
              <>
                <Separator />
                <div className="flex items-center gap-3 pt-1">
                  {packageInfo.homepage && (
                    <a
                      href={packageInfo.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {t('packages.detail.homepage')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {packageInfo.repository && (
                    <a
                      href={packageInfo.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline"
                    >
                      <FileCode className="h-4 w-4" />
                      {t('packages.detail.repository')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column: Quick actions */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('packages.detail.quickActions')}</CardTitle>
            <CardDescription>
              {isInstalled
                ? t('packages.detail.currentVersion') + ': ' + installedPkg?.version
                : t('packages.detail.notInstalled')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Install / Update */}
            {!isInstalled ? (
              <Button className="w-full" onClick={() => onInstall()} disabled={isInstalling}>
                {isInstalling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t('packages.detail.installLatest')}
              </Button>
            ) : hasUpdate ? (
              <Button className="w-full" onClick={() => onInstall(latestVersion!)} disabled={isInstalling}>
                {isInstalling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 mr-2" />
                )}
                {t('packages.detail.updateTo', { version: latestVersion! })}
              </Button>
            ) : null}

            {/* Uninstall */}
            {isInstalled && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('packages.detail.uninstallPackage')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('packages.detail.uninstallConfirmTitle', { name: packageInfo?.name || packageInfo?.display_name || '' })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('packages.detail.uninstallConfirmDesc', { name: packageInfo?.name || '' })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onUninstall}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('packages.detail.uninstallPackage')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Separator />

            {/* Pin / Unpin */}
            {isInstalled && (
              <Button
                variant="outline"
                className="w-full"
                onClick={isPinned ? onUnpin : onPin}
              >
                <Pin className={`h-4 w-4 mr-2 ${isPinned ? 'fill-current' : ''}`} />
                {isPinned ? t('packages.detail.unpinCurrentVersion') : t('packages.detail.pinCurrentVersion')}
              </Button>
            )}

            {/* Bookmark */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full" onClick={onBookmark}>
                  <Star className={`h-4 w-4 mr-2 ${isBookmarked ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                  {isBookmarked ? t('packages.removeBookmark') : t('packages.addBookmark')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isBookmarked ? t('packages.removeBookmark') : t('packages.addBookmark')}
              </TooltipContent>
            </Tooltip>

            {/* Copy name */}
            <Button variant="ghost" className="w-full" onClick={handleCopyName}>
              <Copy className="h-4 w-4 mr-2" />
              {t('packages.detail.copyPackageName')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

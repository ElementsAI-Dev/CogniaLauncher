"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import {
  Download,
  Globe,
  Trash2,
  Loader2,
} from "lucide-react";
import type { EnvironmentInfo } from "@/lib/tauri";
import { formatSize } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VersionPinningSection } from "@/components/environments/version-pinning-section";

interface EnvDetailVersionsProps {
  envType: string;
  env: EnvironmentInfo | null;
  onInstall: (version: string, providerId?: string) => Promise<void>;
  onUninstall: (version: string) => Promise<void>;
  onSetGlobal: (version: string) => Promise<void>;
  onSetLocal: (version: string, projectPath: string) => Promise<void>;
  onOpenVersionBrowser: () => void;
  availableProviders: { id: string; name: string }[];
  selectedProviderId?: string;
  onProviderChange?: (providerId: string) => void;
  loading: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailVersions({
  envType,
  env,
  onInstall,
  onUninstall,
  onSetGlobal,
  onSetLocal,
  onOpenVersionBrowser,
  availableProviders,
  selectedProviderId,
  onProviderChange,
  loading,
  t,
}: EnvDetailVersionsProps) {
  const [customVersion, setCustomVersion] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [uninstallingVersion, setUninstallingVersion] = useState<string | null>(
    null,
  );

  if (!env) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t("environments.detail.notDetected")}</p>
      </div>
    );
  }

  const handleQuickInstall = async (version: string) => {
    setIsInstalling(true);
    try {
      await onInstall(version, selectedProviderId);
      setCustomVersion("");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsInstalling(false);
    }
  };

  const handleCustomInstall = async () => {
    if (!customVersion.trim()) return;
    await handleQuickInstall(customVersion.trim());
  };

  const handleUninstall = async (version: string) => {
    setUninstallingVersion(version);
    try {
      await onUninstall(version);
      toast.success(
        t("environments.details.versionUninstalled", { version }),
      );
    } catch (err) {
      toast.error(String(err));
    } finally {
      setUninstallingVersion(null);
    }
  };


  return (
    <div className="space-y-6">
      {/* Quick Install & Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t("environments.installNewVersion")}
          </CardTitle>
          <CardDescription>
            {t("environments.detail.installDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          {availableProviders.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium shrink-0">
                {t("environments.provider")}:
              </span>
              <Select
                value={selectedProviderId || envType}
                onValueChange={(val) => onProviderChange?.(val)}
              >
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quick Install Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickInstall("latest")}
              disabled={isInstalling || loading}
            >
              {t("environments.latest")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickInstall("lts")}
              disabled={isInstalling || loading}
            >
              {t("environments.lts")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenVersionBrowser}
              className="gap-1.5"
            >
              {t("environments.browseVersions")}
            </Button>
          </div>

          {/* Custom Version Input */}
          <div className="flex gap-2">
            <Input
              placeholder={t("environments.versionPlaceholder")}
              value={customVersion}
              onChange={(e) => setCustomVersion(e.target.value)}
              className="flex-1 font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomInstall();
              }}
            />
            <Button
              onClick={handleCustomInstall}
              disabled={!customVersion.trim() || isInstalling || loading}
              className="gap-2"
            >
              {isInstalling && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("environments.quickInstall")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Installed Versions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                {t("environments.installedVersions")}
              </CardTitle>
              <CardDescription>
                {t("environments.detail.manageInstalledVersions")}
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {env.installed_versions.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {env.installed_versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {t("environments.details.noVersionsInstalled")}
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={onOpenVersionBrowser}
                className="mt-2"
              >
                {t("environments.browseVersions")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {env.installed_versions.map((v) => (
                <div
                  key={v.version}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    v.is_current
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/30 hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-medium text-sm">
                      {v.version}
                    </span>
                    {v.is_current && (
                      <Badge variant="default" className="text-xs">
                        {t("environments.currentVersion")}
                      </Badge>
                    )}
                    {v.size != null && v.size > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {formatSize(v.size)}
                      </span>
                    )}
                    {v.installed_at && (
                      <span className="text-xs text-muted-foreground hidden md:inline">
                        {new Date(v.installed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!v.is_current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSetGlobal(v.version)}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {t("environments.setGlobal")}
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={uninstallingVersion === v.version}
                        >
                          {uninstallingVersion === v.version ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("common.confirm")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("environments.details.confirmUninstall", {
                              type: envType,
                              version: v.version,
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("common.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleUninstall(v.version)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("common.uninstall")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version Pinning */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("environments.details.versionPinning")}
          </CardTitle>
          <CardDescription>
            {t("environments.details.versionPinningDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VersionPinningSection
            installedVersions={env.installed_versions}
            currentVersion={env.current_version}
            onSetGlobal={onSetGlobal}
            onSetLocal={onSetLocal}
            t={t}
          />
        </CardContent>
      </Card>
    </div>
  );
}

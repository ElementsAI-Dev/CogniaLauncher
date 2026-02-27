"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PackageInfo } from "@/lib/tauri";
import {
  ExternalLink,
  Download,
  Globe,
  FileCode,
  Scale,
  Calendar,
  RotateCcw,
  Pin,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/components/providers/locale-provider";
import type { PackageDetailsDialogProps } from "@/types/packages";

export function PackageDetailsDialog({
  pkg,
  open,
  onOpenChange,
  onInstall,
  onRollback,
  onPin,
  fetchPackageInfo,
  isInstalled = false,
  currentVersion,
}: PackageDetailsDialogProps) {
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [installing, setInstalling] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    if (open && pkg) {
      setLoading(true);
      setPackageInfo(null);
      setSelectedVersion("");

      fetchPackageInfo(pkg.name, pkg.provider)
        .then((info) => {
          setPackageInfo(info);
          if (info?.versions?.length) {
            setSelectedVersion(info.versions[0].version);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, pkg, fetchPackageInfo]);

  const handleInstall = async () => {
    if (!pkg) return;
    setInstalling(true);
    try {
      await onInstall(pkg.name, selectedVersion || undefined);
      toast.success(
        t("packages.installing", {
          name: pkg.name,
          version: selectedVersion || "latest",
        }),
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(t("packages.installFailed", { error: String(err) }));
    } finally {
      setInstalling(false);
    }
  };

  const handleRollback = async () => {
    if (!pkg || !onRollback || !selectedVersion) return;
    setRollingBack(true);
    try {
      await onRollback(pkg.name, selectedVersion);
      toast.success(
        t("packages.rollbackSuccess", {
          name: pkg.name,
          version: selectedVersion,
        }),
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(t("packages.rollbackFailed", { error: String(err) }));
    } finally {
      setRollingBack(false);
    }
  };

  const handlePin = async () => {
    if (!pkg || !onPin || !selectedVersion) return;
    try {
      await onPin(pkg.name, selectedVersion);
      toast.success(t("packages.pinned", { name: pkg.name }));
    } catch (err) {
      toast.error(
        t("packages.pinFailed", { name: pkg.name, error: String(err) }),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pkg?.name}
            {pkg?.provider && (
              <Badge variant="secondary" className="ml-2">
                {pkg.provider}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              {loading ? (
                <Skeleton className="h-4 w-3/4" />
              ) : (
                packageInfo?.description ||
                pkg?.description ||
                t("packages.noDescriptionAvailable")
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          {loading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : packageInfo ? (
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                {packageInfo.homepage && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={packageInfo.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1"
                    >
                      {t("packages.homepage")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {packageInfo.repository && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={packageInfo.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1"
                    >
                      {t("packages.repository")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {packageInfo.license && (
                  <div className="flex items-center gap-2 text-sm">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span>{packageInfo.license}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {t("packages.selectVersion")}
                  </h4>
                  {isInstalled && currentVersion && (
                    <span className="text-xs text-muted-foreground">
                      {t("packages.currentVersionLabel")}:{" "}
                      <span className="font-mono">{currentVersion}</span>
                    </span>
                  )}
                </div>
                <Select
                  value={selectedVersion}
                  onValueChange={setSelectedVersion}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t("packages.selectVersionPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {packageInfo.versions.map((v) => (
                      <SelectItem key={v.version} value={v.version}>
                        <div className="flex items-center gap-2">
                          <span>{v.version}</span>
                          {v.deprecated && (
                            <Badge variant="destructive" className="text-xs">
                              {t("packages.deprecated")}
                            </Badge>
                          )}
                          {v.yanked && (
                            <Badge variant="secondary" className="text-xs">
                              {t("packages.yanked")}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {t("packages.versionHistory")}
                </h4>
                <ScrollArea className="max-h-40">
                  <div className="space-y-1">
                    {packageInfo.versions.slice(0, 10).map((v) => (
                      <div
                        key={v.version}
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{v.version}</span>
                          {v.deprecated && (
                            <Badge variant="outline" className="text-xs">
                              {t("packages.deprecated")}
                            </Badge>
                          )}
                        </div>
                        {v.release_date && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(v.release_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                    {packageInfo.versions.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {t("packages.moreVersions", {
                          count: packageInfo.versions.length - 10,
                        })}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t("packages.loadFailed")}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>

          {/* Pin button - only for installed packages */}
          {isInstalled && onPin && selectedVersion && (
            <Button
              variant="outline"
              onClick={handlePin}
              disabled={loading || !packageInfo}
            >
              <Pin className="h-4 w-4 mr-2" />
              {t("packages.pinVersion")}
            </Button>
          )}

          {/* Rollback button - only for installed packages with version different from current */}
          {isInstalled &&
            onRollback &&
            selectedVersion &&
            selectedVersion !== currentVersion && (
              <Button
                variant="secondary"
                onClick={handleRollback}
                disabled={rollingBack || loading || !packageInfo}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {rollingBack
                  ? t("packages.rollingBack")
                  : t("packages.rollback")}
              </Button>
            )}

          <Button
            onClick={handleInstall}
            disabled={installing || loading || !packageInfo}
          >
            <Download className="h-4 w-4 mr-2" />
            {installing
              ? t("packages.installing", { name: "", version: "" })
              : t("packages.installVersion", {
                  version: selectedVersion || t("packages.latest"),
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

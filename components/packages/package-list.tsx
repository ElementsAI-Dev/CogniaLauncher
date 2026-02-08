"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Download,
  Trash2,
  Info,
  Loader2,
  Package,
  Pin,
  Star,
} from "lucide-react";
import { usePackageStore } from "@/lib/stores/packages";
import { useLocale } from "@/components/providers/locale-provider";
import type { PackageSummary, InstalledPackage } from "@/lib/tauri";

interface PackageListProps {
  packages: (PackageSummary | InstalledPackage)[];
  type: "search" | "installed";
  installing?: string[];
  pinnedPackages?: string[];
  bookmarkedPackages?: string[];
  onInstall?: (name: string) => void;
  onUninstall?: (name: string) => void;
  onSelect?: (pkg: PackageSummary | InstalledPackage) => void;
  onPin?: (name: string) => void;
  onUnpin?: (name: string) => void;
  onBookmark?: (name: string) => void;
  selectable?: boolean;
  showSelectAll?: boolean;
}

export function PackageList({
  packages,
  type,
  installing = [],
  pinnedPackages = [],
  bookmarkedPackages = [],
  onInstall,
  onUninstall,
  onSelect,
  onPin,
  onUnpin,
  onBookmark,
  selectable = true,
  showSelectAll = true,
}: PackageListProps) {
  const router = useRouter();
  const {
    selectedPackages,
    togglePackageSelection,
    selectAllPackages,
    clearPackageSelection,
  } = usePackageStore();
  const { t } = useLocale();

  const getPackageKey = (pkg: PackageSummary | InstalledPackage) =>
    pkg.provider ? `${pkg.provider}:${pkg.name}` : pkg.name;

  const allSelected =
    packages.length > 0 &&
    packages.every((p) => selectedPackages.includes(getPackageKey(p)));
  const someSelected = packages.some((p) =>
    selectedPackages.includes(getPackageKey(p)),
  );

  const handleSelectAll = () => {
    if (allSelected) {
      clearPackageSelection();
    } else {
      selectAllPackages(packages.map((p) => getPackageKey(p)));
    }
  };

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 bg-muted rounded-full mb-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-1">
          {type === "search"
            ? t("packages.noResults")
            : t("packages.noPackagesInstalled")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {type === "search"
            ? t("packages.searchTips")
            : t("packages.description")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Select All Header */}
      {selectable && showSelectAll && packages.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedPackages.length > 0
                ? t("packages.selected", { count: selectedPackages.length })
                : t("packages.selectAll")}
            </span>
          </div>
          {selectedPackages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearPackageSelection}>
              {t("packages.deselectAll")}
            </Button>
          )}
        </div>
      )}

      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-4">
          {packages.map((pkg, index) => {
            const isInstalled = type === "installed";
            const packageKey = getPackageKey(pkg);
            const uniqueKey = `${packageKey}-${index}`;
            const isInstalling = installing.includes(packageKey);
            const version = isInstalled
              ? (pkg as InstalledPackage).version
              : (pkg as PackageSummary).latest_version;
            const isSelected = selectedPackages.includes(packageKey);

            const isPinned = pinnedPackages.includes(pkg.name);

            return (
              <div
                key={uniqueKey}
                className={`
                flex items-center justify-between p-4 
                bg-card border rounded-lg cursor-pointer 
                hover:bg-accent/50 transition-colors
                ${isSelected ? "border-primary bg-accent/30" : "border-border"}
              `}
                onClick={() => {
                  const params = new URLSearchParams({ name: pkg.name });
                  if (pkg.provider) params.set('provider', pkg.provider);
                  router.push(`/packages/detail?${params.toString()}`);
                }}
              >
                {/* Left side - checkbox and info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {selectable && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => togglePackageSelection(packageKey)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-foreground truncate">
                        {pkg.name}
                      </span>
                      {isPinned && (
                        <Pin className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    {"description" in pkg && pkg.description && (
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {pkg.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side - badges and actions */}
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {version && (
                    <Badge
                      variant="outline"
                      className="font-mono text-xs px-2 py-1"
                    >
                      {version}
                    </Badge>
                  )}
                  <Badge className="text-xs px-2 py-1 bg-muted text-muted-foreground hover:bg-muted">
                    {pkg.provider}
                  </Badge>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect?.(pkg);
                        }}
                      >
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("common.info")}</TooltipContent>
                  </Tooltip>

                  {/* Pin/Unpin button for installed packages */}
                  {isInstalled && onPin && onUnpin && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPinned) {
                              onUnpin(pkg.name);
                            } else {
                              onPin(pkg.name);
                            }
                          }}
                        >
                          <Pin
                            className={`h-4 w-4 ${isPinned ? "text-primary fill-primary" : "text-muted-foreground"}`}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isPinned
                          ? t("packages.unpinVersion")
                          : t("packages.pinVersion")}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Bookmark button */}
                  {onBookmark && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookmark(pkg.name);
                          }}
                        >
                          <Star
                            className={`h-4 w-4 ${bookmarkedPackages.includes(pkg.name) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {bookmarkedPackages.includes(pkg.name)
                          ? t("packages.removeBookmark")
                          : t("packages.addBookmark")}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {isInstalled ? (
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.uninstall")}</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("common.uninstall")} {pkg.name}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("packages.uninstallConfirm", { name: pkg.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("common.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onUninstall?.(packageKey)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("common.uninstall")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              className="h-8 w-8"
                              disabled={isInstalling}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isInstalling ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.install")}</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("common.install")} {pkg.name}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("packages.installConfirm", { name: pkg.name })}
                            {version && (
                              <span className="block mt-2 font-mono text-sm">
                                {t("packages.version")}: {version}
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("common.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onInstall?.(packageKey)}
                          >
                            {t("common.install")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

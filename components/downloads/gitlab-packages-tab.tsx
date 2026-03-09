"use client";

import { type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/utils";
import { selectableCheckboxRowClass, SelectableCardButton } from "./selectable-list-patterns";
import type { GitLabPackageInfo, GitLabPackageFileInfo } from "@/types/gitlab";

interface GitLabPackagesTabProps {
  packages: GitLabPackageInfo[];
  selectedPackageId: number | null;
  onSelectPackage: (packageId: number) => void;
  packageFiles: GitLabPackageFileInfo[];
  selectedPackageFileIds: Set<number>;
  onToggleFile: (fileId: number) => void;
  packageFilesLoading: boolean;
  packageTypeFilter: string;
  onFilterChange: (value: string) => void;
  onApplyFilter: () => void;
  onClearFilter: () => void;
  onFilterKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  t: (key: string) => string;
}

export function GitLabPackagesTab({
  packages,
  selectedPackageId,
  onSelectPackage,
  packageFiles,
  selectedPackageFileIds,
  onToggleFile,
  packageFilesLoading,
  packageTypeFilter,
  onFilterChange,
  onApplyFilter,
  onClearFilter,
  onFilterKeyDown,
  t,
}: GitLabPackagesTabProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Label>{t("downloads.gitlab.packages")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onApplyFilter}
        >
          {t("common.refresh")}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={packageTypeFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          onKeyDown={onFilterKeyDown}
          placeholder={t("downloads.gitlab.packageTypePlaceholder")}
          aria-label={t("downloads.gitlab.packageType")}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onApplyFilter}
        >
          {t("downloads.gitlab.applyPackageType")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearFilter}
          disabled={!packageTypeFilter.trim()}
        >
          {t("common.clear")}
        </Button>
      </div>

      <ScrollArea className="h-35 border rounded-md">
        {packages.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.noPackages")}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {packages.map((pkg) => (
              <SelectableCardButton
                key={pkg.id}
                selected={selectedPackageId === pkg.id}
                onClick={() => onSelectPackage(pkg.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {pkg.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {pkg.packageType}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  v{pkg.version}
                </div>
              </SelectableCardButton>
            ))}
          </div>
        )}
      </ScrollArea>

      <Label>{t("downloads.gitlab.packageFiles")}</Label>
      <ScrollArea className="h-40 border rounded-md">
        {packageFilesLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !selectedPackageId ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.selectPackage")}
          </div>
        ) : packageFiles.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.noPackageFiles")}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {packageFiles.map((file) => {
              const checked = selectedPackageFileIds.has(file.id);
              return (
                <label
                  key={file.id}
                  className={selectableCheckboxRowClass({
                    selected: checked,
                  })}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggleFile(file.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {file.fileName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

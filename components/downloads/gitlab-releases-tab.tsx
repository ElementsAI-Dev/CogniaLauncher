"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar, FileArchive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitLabReleaseInfo, GitLabAssetInfo } from "@/types/gitlab";

interface GitLabReleasesTabProps {
  releases: GitLabReleaseInfo[];
  selectedRelease: string | null;
  onSelectRelease: (tagName: string) => void;
  selectedAssets: GitLabAssetInfo[];
  onAssetToggle: (asset: GitLabAssetInfo) => void;
  t: (key: string) => string;
}

export function GitLabReleasesTab({
  releases,
  selectedRelease,
  onSelectRelease,
  selectedAssets,
  onAssetToggle,
  t,
}: GitLabReleasesTabProps) {
  const currentRelease = useMemo(() => {
    return releases.find((r) => r.tagName === selectedRelease);
  }, [releases, selectedRelease]);

  return (
    <>
      <ScrollArea className="h-[200px] border rounded-md">
        {releases.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.noReleases")}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {releases.map((release) => (
              <div
                key={release.tagName}
                className={cn(
                  "p-3 rounded-md cursor-pointer transition-colors",
                  selectedRelease === release.tagName
                    ? "bg-primary/10 border border-primary"
                    : "hover:bg-muted",
                )}
                onClick={() => onSelectRelease(release.tagName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {release.tagName}
                    </span>
                    {release.name &&
                      release.name !== release.tagName && (
                        <span className="text-sm text-muted-foreground">
                          {release.name}
                        </span>
                      )}
                    {release.upcomingRelease && (
                      <Badge variant="secondary">
                        {t("downloads.gitlab.upcoming")}
                      </Badge>
                    )}
                  </div>
                  {release.releasedAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(
                        release.releasedAt,
                      ).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {release.assets.length}{" "}
                  {t("downloads.gitlab.assets")}
                  {release.sources.length > 0 && (
                    <span>
                      {" + "}
                      {release.sources.length}{" "}
                      {t("downloads.gitlab.sources")}
                    </span>
                  )}
                </div>
                {selectedRelease === release.tagName &&
                  release.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                      {release.description}
                    </p>
                  )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Asset Selection */}
      {currentRelease && currentRelease.assets.length > 0 && (
        <div className="mt-3">
          <Label>{t("downloads.gitlab.selectAssets")}</Label>
          <ScrollArea className="h-[140px] border rounded-md mt-2">
            <div className="p-2 space-y-1">
              {currentRelease.assets.map((asset) => {
                const isSelected = !!selectedAssets.find(
                  (a) => a.id === asset.id,
                );
                return (
                  <label
                    key={asset.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        onAssetToggle(asset)
                      }
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileArchive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-mono truncate">
                        {asset.name}
                      </span>
                    </div>
                    {asset.linkType && (
                      <Badge
                        variant="outline"
                        className="text-xs ml-2"
                      >
                        {asset.linkType}
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
}

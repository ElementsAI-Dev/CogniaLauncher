"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createArtifactProfilePreview } from "@/lib/downloads";
import {
  useAssetMatcher,
  getArchLabel,
  getPlatformLabel,
} from "@/hooks/downloads/use-asset-matcher";
import { Calendar, FileArchive, Star } from "lucide-react";
import {
  SelectableCardButton,
  selectableCheckboxRowClass,
} from "./selectable-list-patterns";
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
  const { parseAssets, currentPlatform, currentArch } = useAssetMatcher();
  const currentRelease = useMemo(() => {
    return releases.find((r) => r.tagName === selectedRelease);
  }, [releases, selectedRelease]);
  const parsedAssets = useMemo(() => {
    if (!currentRelease) return [];
    return parseAssets(currentRelease.assets);
  }, [currentRelease, parseAssets]);

  return (
    <>
      <ScrollArea className="h-50 border rounded-md">
        {releases.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("downloads.gitlab.noReleases")}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {releases.map((release) => (
              <SelectableCardButton
                key={release.tagName}
                selected={selectedRelease === release.tagName}
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
              </SelectableCardButton>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Asset Selection */}
      {currentRelease && currentRelease.assets.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label>{t("downloads.gitlab.selectAssets")}</Label>
            {currentPlatform !== "unknown" && (
              <span className="text-xs text-muted-foreground">
                {getPlatformLabel(currentPlatform)} {getArchLabel(currentArch)}
              </span>
            )}
          </div>
          <ScrollArea className="h-35 border rounded-md mt-2">
            <div className="p-2 space-y-1">
              {parsedAssets.map(({ asset, platform, arch, isRecommended }) => {
                const isSelected = !!selectedAssets.find(
                  (a) => a.id === asset.id,
                );
                const profile = createArtifactProfilePreview({
                  fileName: asset.name,
                  sourceKind: "gitlab_release_asset",
                });
                return (
                  <label
                    key={asset.id}
                    className={selectableCheckboxRowClass({
                      selected: isSelected || isRecommended,
                      tone: isRecommended ? "success" : "default",
                      className: isSelected
                        ? "border-primary bg-primary/10 hover:bg-primary/15"
                        : undefined,
                    })}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        onAssetToggle(asset)
                      }
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isRecommended ? (
                        <Star className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <FileArchive className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-mono truncate">
                        {asset.name}
                      </span>
                    </div>
                    {isRecommended && (
                      <Badge
                        variant="secondary"
                        className="text-xs ml-2"
                      >
                        {t("downloads.gitlab.recommended")}
                      </Badge>
                    )}
                    {asset.linkType && (
                      <Badge
                        variant="outline"
                        className="text-xs ml-2"
                      >
                        {asset.linkType}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs ml-2">
                      {t(`downloads.artifactKind.${profile.artifactKind}`)}
                    </Badge>
                    {platform !== "unknown" && (
                      <Badge variant="outline" className="text-xs ml-2">
                        {getPlatformLabel(platform)}
                      </Badge>
                    )}
                    {arch !== "unknown" && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        {getArchLabel(arch)}
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

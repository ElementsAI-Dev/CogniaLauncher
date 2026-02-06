"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLocale } from "@/components/providers/locale-provider";
import { useGitHubDownloads } from "@/hooks/use-github-downloads";
import {
  useAssetMatcher,
  getPlatformLabel,
  getArchLabel,
  type ParsedAsset,
} from "@/hooks/use-asset-matcher";
import { isTauri } from "@/lib/tauri";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Github,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Tag,
  GitBranch,
  Package,
  FolderOpen,
  AlertCircle,
  FileArchive,
  Calendar,
  Star,
} from "lucide-react";
import type {
  GitHubAssetInfo,
  GitHubArchiveFormat,
  GitHubSourceType,
} from "@/types/github";

interface GitHubDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadStarted?: (taskId: string) => void;
}

export function GitHubDownloadDialog({
  open,
  onOpenChange,
  onDownloadStarted,
}: GitHubDownloadDialogProps) {
  const { t } = useLocale();
  const isDesktop = isTauri();

  const {
    repoInput,
    setRepoInput,
    parsedRepo,
    isValidating,
    isValid,
    sourceType,
    setSourceType,
    branches,
    tags,
    releases,
    loading,
    error,
    validateAndFetch,
    downloadAsset,
    downloadSource,
    reset,
  } = useGitHubDownloads();

  const { parseAssets, currentPlatform, currentArch } = useAssetMatcher();

  const [destination, setDestination] = useState("");
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<GitHubAssetInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [archiveFormat, setArchiveFormat] =
    useState<GitHubArchiveFormat>("zip");
  const [isDownloading, setIsDownloading] = useState(false);

  const currentRelease = useMemo(() => {
    return releases.find((r) => r.tagName === selectedRelease);
  }, [releases, selectedRelease]);

  const parsedAssets = useMemo((): ParsedAsset[] => {
    if (!currentRelease) return [];
    return parseAssets(currentRelease.assets);
  }, [currentRelease, parseAssets]);

  const handleClose = useCallback(() => {
    reset();
    setDestination("");
    setSelectedRelease(null);
    setSelectedAssets([]);
    setSelectedBranch(null);
    setSelectedTag(null);
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const handleValidate = useCallback(async () => {
    await validateAndFetch();
  }, [validateAndFetch]);

  const handlePickFolder = useCallback(async () => {
    if (!isDesktop) return;
    try {
      const dialogModule = await import(
        "@tauri-apps/plugin-dialog"
      ).catch(() => null);
      if (dialogModule?.open) {
        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
        });
        if (selected && typeof selected === "string") {
          setDestination(selected);
        }
      }
    } catch (err) {
      console.error("Failed to open folder picker", err);
    }
  }, [isDesktop]);

  const handleAssetToggle = useCallback((asset: GitHubAssetInfo) => {
    setSelectedAssets((prev) => {
      const exists = prev.find((a) => a.id === asset.id);
      if (exists) {
        return prev.filter((a) => a.id !== asset.id);
      }
      return [...prev, asset];
    });
  }, []);

  const handleDownload = useCallback(async () => {
    if (!destination.trim()) {
      toast.error(t("downloads.github.noDestination"));
      return;
    }

    setIsDownloading(true);

    try {
      if (sourceType === "release" && selectedAssets.length > 0) {
        for (const asset of selectedAssets) {
          const taskId = await downloadAsset(asset, destination);
          onDownloadStarted?.(taskId);
        }
        toast.success(
          t("downloads.github.assetsAdded", { count: selectedAssets.length }),
        );
      } else if (sourceType === "branch" && selectedBranch) {
        const taskId = await downloadSource(
          selectedBranch,
          archiveFormat,
          destination,
        );
        onDownloadStarted?.(taskId);
        toast.success(t("downloads.github.sourceAdded"));
      } else if (sourceType === "tag" && selectedTag) {
        const taskId = await downloadSource(
          selectedTag,
          archiveFormat,
          destination,
        );
        onDownloadStarted?.(taskId);
        toast.success(t("downloads.github.sourceAdded"));
      } else {
        toast.error(t("downloads.github.noSelection"));
        return;
      }

      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDownloading(false);
    }
  }, [
    destination,
    sourceType,
    selectedAssets,
    selectedBranch,
    selectedTag,
    archiveFormat,
    downloadAsset,
    downloadSource,
    onDownloadStarted,
    handleClose,
    t,
  ]);

  const canDownload =
    destination.trim() &&
    ((sourceType === "release" && selectedAssets.length > 0) ||
      (sourceType === "branch" && selectedBranch) ||
      (sourceType === "tag" && selectedTag));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            {t("downloads.github.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("downloads.github.dialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Repository Input */}
          <div className="space-y-2">
            <Label>{t("downloads.github.repository")}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder={t("downloads.github.repoPlaceholder")}
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleValidate()}
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isValid === true ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isValid === false ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : null}
                </div>
              </div>
              <Button
                onClick={handleValidate}
                disabled={isValidating || !repoInput.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                {t("downloads.github.fetch")}
              </Button>
            </div>
            {parsedRepo && isValid && (
              <p className="text-sm text-muted-foreground">
                {t("downloads.github.repoValid")}:{" "}
                <code>{parsedRepo.fullName}</code>
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Source Type Tabs */}
          {isValid && (
            <Tabs
              value={sourceType}
              onValueChange={(v) => setSourceType(v as GitHubSourceType)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="release" className="gap-2">
                  <Package className="h-4 w-4" />
                  {t("downloads.github.releases")}
                  <Badge variant="secondary" className="ml-1">
                    {releases.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="branch" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  {t("downloads.github.branches")}
                  <Badge variant="secondary" className="ml-1">
                    {branches.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="tag" className="gap-2">
                  <Tag className="h-4 w-4" />
                  {t("downloads.github.tags")}
                  <Badge variant="secondary" className="ml-1">
                    {tags.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {loading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Releases Tab */}
                  <TabsContent
                    value="release"
                    className="flex-1 overflow-hidden mt-2"
                  >
                    <ScrollArea className="h-[200px] border rounded-md">
                      {releases.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.github.noReleases")}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {releases.map((release) => (
                            <div
                              key={release.id}
                              className={cn(
                                "p-3 rounded-md cursor-pointer transition-colors",
                                selectedRelease === release.tagName
                                  ? "bg-primary/10 border border-primary"
                                  : "hover:bg-muted",
                              )}
                              onClick={() => {
                                setSelectedRelease(release.tagName);
                                setSelectedAssets([]);
                              }}
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
                                  {release.prerelease && (
                                    <Badge variant="secondary">
                                      {t("downloads.github.prerelease")}
                                    </Badge>
                                  )}
                                </div>
                                {release.publishedAt && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(
                                      release.publishedAt,
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {release.assets.length}{" "}
                                {t("downloads.github.assets")}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    {/* Asset Selection */}
                    {currentRelease && parsedAssets.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label>{t("downloads.github.selectAssets")}</Label>
                          {currentPlatform !== "unknown" && (
                            <span className="text-xs text-muted-foreground">
                              {t("downloads.github.yourPlatform")}:{" "}
                              {getPlatformLabel(currentPlatform)}{" "}
                              {getArchLabel(currentArch)}
                            </span>
                          )}
                        </div>
                        <ScrollArea className="h-[140px] border rounded-md">
                          <div className="p-2 space-y-1">
                            {parsedAssets.map(
                              ({
                                asset,
                                platform,
                                arch,
                                isRecommended,
                                isFallback,
                              }) => (
                                <div
                                  key={asset.id}
                                  className={cn(
                                    "flex items-center justify-between p-2 rounded cursor-pointer transition-colors",
                                    selectedAssets.find(
                                      (a) => a.id === asset.id,
                                    )
                                      ? "bg-primary/10 border border-primary"
                                      : isRecommended
                                        ? "bg-green-500/5 hover:bg-green-500/10 border border-green-500/20"
                                        : "hover:bg-muted",
                                  )}
                                  onClick={() => handleAssetToggle(asset)}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {isRecommended && (
                                      <Star className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    )}
                                    {!isRecommended && (
                                      <FileArchive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <span className="text-sm font-mono truncate">
                                      {asset.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    {platform !== "unknown" && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {getPlatformLabel(platform)}
                                      </Badge>
                                    )}
                                    {arch !== "unknown" && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {getArchLabel(arch)}
                                      </Badge>
                                    )}
                                    {isFallback && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-amber-500 border-amber-500/50"
                                      >
                                        {t("downloads.github.rosetta")}
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {asset.sizeHuman}
                                    </span>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </TabsContent>

                  {/* Branches Tab */}
                  <TabsContent
                    value="branch"
                    className="flex-1 overflow-hidden mt-2"
                  >
                    <ScrollArea className="h-[200px] border rounded-md">
                      {branches.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.github.noBranches")}
                        </div>
                      ) : (
                        <RadioGroup
                          value={selectedBranch || ""}
                          onValueChange={setSelectedBranch}
                          className="p-2"
                        >
                          {branches.map((branch) => (
                            <div
                              key={branch.name}
                              className="flex items-center space-x-2 p-2 rounded hover:bg-muted"
                            >
                              <RadioGroupItem
                                value={branch.name}
                                id={`branch-${branch.name}`}
                              />
                              <Label
                                htmlFor={`branch-${branch.name}`}
                                className="flex-1 cursor-pointer flex items-center justify-between"
                              >
                                <span className="font-mono">{branch.name}</span>
                                {branch.protected && (
                                  <Badge variant="outline">
                                    {t("downloads.github.protected")}
                                  </Badge>
                                )}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </ScrollArea>

                    {/* Archive Format Selection */}
                    {selectedBranch && (
                      <div className="mt-3 flex items-center gap-4">
                        <Label>{t("downloads.github.format")}:</Label>
                        <RadioGroup
                          value={archiveFormat}
                          onValueChange={(v) =>
                            setArchiveFormat(v as GitHubArchiveFormat)
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="zip" id="format-zip" />
                            <Label htmlFor="format-zip">ZIP</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="tar.gz" id="format-tar" />
                            <Label htmlFor="format-tar">TAR.GZ</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tags Tab */}
                  <TabsContent
                    value="tag"
                    className="flex-1 overflow-hidden mt-2"
                  >
                    <ScrollArea className="h-[200px] border rounded-md">
                      {tags.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.github.noTags")}
                        </div>
                      ) : (
                        <RadioGroup
                          value={selectedTag || ""}
                          onValueChange={setSelectedTag}
                          className="p-2"
                        >
                          {tags.map((tag) => (
                            <div
                              key={tag.name}
                              className="flex items-center space-x-2 p-2 rounded hover:bg-muted"
                            >
                              <RadioGroupItem
                                value={tag.name}
                                id={`tag-${tag.name}`}
                              />
                              <Label
                                htmlFor={`tag-${tag.name}`}
                                className="flex-1 cursor-pointer font-mono"
                              >
                                {tag.name}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </ScrollArea>

                    {/* Archive Format Selection */}
                    {selectedTag && (
                      <div className="mt-3 flex items-center gap-4">
                        <Label>{t("downloads.github.format")}:</Label>
                        <RadioGroup
                          value={archiveFormat}
                          onValueChange={(v) =>
                            setArchiveFormat(v as GitHubArchiveFormat)
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="zip" id="tag-format-zip" />
                            <Label htmlFor="tag-format-zip">ZIP</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="tar.gz"
                              id="tag-format-tar"
                            />
                            <Label htmlFor="tag-format-tar">TAR.GZ</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}

          {/* Destination */}
          {isValid && (
            <div className="space-y-2">
              <Label>{t("downloads.github.destination")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t("downloads.github.destinationPlaceholder")}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="flex-1"
                />
                {isDesktop && (
                  <Button variant="outline" onClick={handlePickFolder}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!canDownload || isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t("downloads.github.addToQueue")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

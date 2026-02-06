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
import { useGitLabDownloads } from "@/hooks/use-gitlab-downloads";
import { isTauri } from "@/lib/tauri";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
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
  Archive,
} from "lucide-react";
import type {
  GitLabAssetInfo,
  GitLabArchiveFormat,
  GitLabSourceType,
} from "@/types/gitlab";

interface GitLabDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadStarted?: (taskId: string) => void;
}

export function GitLabDownloadDialog({
  open,
  onOpenChange,
  onDownloadStarted,
}: GitLabDownloadDialogProps) {
  const { t } = useLocale();
  const isDesktop = isTauri();

  const {
    projectInput,
    setProjectInput,
    parsedProject,
    projectInfo,
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
  } = useGitLabDownloads();

  const [destination, setDestination] = useState("");
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<GitLabAssetInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [archiveFormat, setArchiveFormat] =
    useState<GitLabArchiveFormat>("zip");
  const [isDownloading, setIsDownloading] = useState(false);

  const currentRelease = useMemo(() => {
    return releases.find((r) => r.tagName === selectedRelease);
  }, [releases, selectedRelease]);

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
      const dialogModule = await import("@tauri-apps/plugin-dialog");
      const selected = await dialogModule.open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setDestination(selected);
      }
    } catch (err) {
      console.error("Failed to open folder picker:", err);
      toast.error(t("downloads.gitlab.folderPickerError"));
    }
  }, [isDesktop, t]);

  const handleAssetToggle = useCallback((asset: GitLabAssetInfo) => {
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
      toast.error(t("downloads.gitlab.noDestination"));
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
          t("downloads.gitlab.assetsAdded", { count: selectedAssets.length }),
        );
      } else if (sourceType === "branch" && selectedBranch) {
        const taskId = await downloadSource(
          selectedBranch,
          archiveFormat,
          destination,
        );
        onDownloadStarted?.(taskId);
        toast.success(t("downloads.gitlab.sourceAdded"));
      } else if (sourceType === "tag" && selectedTag) {
        const taskId = await downloadSource(
          selectedTag,
          archiveFormat,
          destination,
        );
        onDownloadStarted?.(taskId);
        toast.success(t("downloads.gitlab.sourceAdded"));
      } else {
        toast.error(t("downloads.gitlab.noSelection"));
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
            <Archive className="h-5 w-5" />
            {t("downloads.gitlab.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("downloads.gitlab.dialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Project Input */}
          <div className="space-y-2">
            <Label>{t("downloads.gitlab.project")}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder={t("downloads.gitlab.projectPlaceholder")}
                  value={projectInput}
                  onChange={(e) => setProjectInput(e.target.value)}
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
                disabled={isValidating || !projectInput.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                {t("downloads.gitlab.fetch")}
              </Button>
            </div>
            {parsedProject && isValid && (
              <div className="text-sm text-muted-foreground">
                <span>
                  {t("downloads.gitlab.projectValid")}:{" "}
                  <code>{parsedProject.fullName}</code>
                </span>
                {projectInfo && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {projectInfo.starCount}
                  </span>
                )}
              </div>
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
              onValueChange={(v) => setSourceType(v as GitLabSourceType)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="release" className="gap-2">
                  <Package className="h-4 w-4" />
                  {t("downloads.gitlab.releases")}
                  <Badge variant="secondary" className="ml-1">
                    {releases.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="branch" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  {t("downloads.gitlab.branches")}
                  <Badge variant="secondary" className="ml-1">
                    {branches.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="tag" className="gap-2">
                  <Tag className="h-4 w-4" />
                  {t("downloads.gitlab.tags")}
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
                            {currentRelease.assets.map((asset) => (
                              <div
                                key={asset.id}
                                className={cn(
                                  "flex items-center justify-between p-2 rounded cursor-pointer transition-colors",
                                  selectedAssets.find(
                                    (a) => a.id === asset.id,
                                  )
                                    ? "bg-primary/10 border border-primary"
                                    : "hover:bg-muted",
                                )}
                                onClick={() => handleAssetToggle(asset)}
                              >
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
                              </div>
                            ))}
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
                          {t("downloads.gitlab.noBranches")}
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
                                id={`gl-branch-${branch.name}`}
                              />
                              <Label
                                htmlFor={`gl-branch-${branch.name}`}
                                className="flex-1 cursor-pointer flex items-center justify-between"
                              >
                                <span className="font-mono">{branch.name}</span>
                                <div className="flex gap-1">
                                  {branch.default && (
                                    <Badge variant="secondary">
                                      {t("downloads.gitlab.default")}
                                    </Badge>
                                  )}
                                  {branch.protected && (
                                    <Badge variant="outline">
                                      {t("downloads.gitlab.protected")}
                                    </Badge>
                                  )}
                                </div>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </ScrollArea>

                    {selectedBranch && (
                      <div className="mt-3 flex items-center gap-4">
                        <Label>{t("downloads.gitlab.format")}:</Label>
                        <RadioGroup
                          value={archiveFormat}
                          onValueChange={(v) =>
                            setArchiveFormat(v as GitLabArchiveFormat)
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="zip" id="gl-format-zip" />
                            <Label htmlFor="gl-format-zip">ZIP</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="tar.gz" id="gl-format-tar" />
                            <Label htmlFor="gl-format-tar">TAR.GZ</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="tar.bz2"
                              id="gl-format-bz2"
                            />
                            <Label htmlFor="gl-format-bz2">TAR.BZ2</Label>
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
                          {t("downloads.gitlab.noTags")}
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
                                id={`gl-tag-${tag.name}`}
                              />
                              <Label
                                htmlFor={`gl-tag-${tag.name}`}
                                className="flex-1 cursor-pointer flex items-center justify-between"
                              >
                                <span className="font-mono">{tag.name}</span>
                                {tag.protected && (
                                  <Badge variant="outline">
                                    {t("downloads.gitlab.protected")}
                                  </Badge>
                                )}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </ScrollArea>

                    {selectedTag && (
                      <div className="mt-3 flex items-center gap-4">
                        <Label>{t("downloads.gitlab.format")}:</Label>
                        <RadioGroup
                          value={archiveFormat}
                          onValueChange={(v) =>
                            setArchiveFormat(v as GitLabArchiveFormat)
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="zip"
                              id="gl-tag-format-zip"
                            />
                            <Label htmlFor="gl-tag-format-zip">ZIP</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="tar.gz"
                              id="gl-tag-format-tar"
                            />
                            <Label htmlFor="gl-tag-format-tar">TAR.GZ</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="tar.bz2"
                              id="gl-tag-format-bz2"
                            />
                            <Label htmlFor="gl-tag-format-bz2">TAR.BZ2</Label>
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
              <Label>{t("downloads.gitlab.destination")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t("downloads.gitlab.destinationPlaceholder")}
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
            {t("downloads.gitlab.addToQueue")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

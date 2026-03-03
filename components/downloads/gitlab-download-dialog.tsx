"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type KeyboardEvent,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocale } from "@/components/providers/locale-provider";
import { useGitLabDownloads } from "@/hooks/use-gitlab-downloads";
import { isTauri } from "@/lib/tauri";
import { GITLAB_ARCHIVE_FORMATS } from "@/lib/constants/downloads";
import { runDownloadPreflightWithUi } from "@/lib/downloads";
import { toast } from "sonner";
import { cn, formatBytes } from "@/lib/utils";
import { RepoValidationInput } from "./repo-validation-input";
import { DestinationPicker } from "./destination-picker";
import { RefListSelector, type RefItem } from "./ref-list-selector";
import {
  ArchiveFormatSelector,
} from "./archive-format-selector";
import {
  Loader2,
  Download,
  Tag,
  GitBranch,
  Package,
  AlertCircle,
  FileArchive,
  Calendar,
  Star,
  Gitlab,
  KeyRound,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Save,
  Trash2,
} from "lucide-react";
import type {
  GitLabAssetInfo,
  GitLabArchiveFormat,
  GitLabJobInfo,
  GitLabSourceType,
} from "@/types/gitlab";

interface GitLabDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadStarted?: (taskId: string) => void;
  checkDiskSpace?: (path: string, required: number) => Promise<boolean>;
}

export function GitLabDownloadDialog({
  open,
  onOpenChange,
  onDownloadStarted,
  checkDiskSpace,
}: GitLabDownloadDialogProps) {
  const { t } = useLocale();
  const isDesktop = isTauri();

  const {
    projectInput,
    setProjectInput,
    token,
    setToken,
    instanceUrl,
    setInstanceUrl,
    parsedProject,
    projectInfo,
    isValidating,
    isValid,
    sourceType,
    setSourceType,
    branches,
    tags,
    releases,
    pipelines,
    jobs,
    packages,
    packageFiles,
    loading,
    error,
    validateAndFetch,
    fetchPipelines,
    fetchPipelineJobs,
    fetchPackages,
    fetchPackageFiles,
    downloadAsset,
    downloadSource,
    downloadJobArtifacts,
    downloadPackageFile,
    saveToken,
    saveInstanceUrl,
    clearSavedToken,
    reset,
  } = useGitLabDownloads();

  const [destination, setDestination] = useState("");
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<GitLabAssetInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<GitLabJobInfo[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedPackageFileIds, setSelectedPackageFileIds] = useState<Set<number>>(new Set());
  const [packageTypeFilter, setPackageTypeFilter] = useState("");
  const [archiveFormat, setArchiveFormat] =
    useState<GitLabArchiveFormat>("zip");
  const [isDownloading, setIsDownloading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [packageFilesLoading, setPackageFilesLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showToken, setShowToken] = useState(false);

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
    setSelectedPipelineId(null);
    setSelectedJobs([]);
    setSelectedPackageId(null);
    setSelectedPackageFileIds(new Set());
    setPackageTypeFilter("");
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const handleValidate = useCallback(async () => {
    await validateAndFetch();
  }, [validateAndFetch]);

  const handleAssetToggle = useCallback((asset: GitLabAssetInfo) => {
    setSelectedAssets((prev) => {
      const exists = prev.find((a) => a.id === asset.id);
      if (exists) {
        return prev.filter((a) => a.id !== asset.id);
      }
      return [...prev, asset];
    });
  }, []);

  const handleSaveToken = useCallback(async () => {
    await saveToken();
    if (instanceUrl.trim()) {
      await saveInstanceUrl();
    }
    toast.success(t("downloads.gitlab.tokenSaved"));
  }, [saveToken, saveInstanceUrl, instanceUrl, t]);

  const handleClearToken = useCallback(async () => {
    await clearSavedToken();
    toast.success(t("downloads.gitlab.tokenCleared"));
  }, [clearSavedToken, t]);

  const handleSaveInstanceUrl = useCallback(async () => {
    await saveInstanceUrl();
    toast.success(t("downloads.gitlab.instanceUrlSaved"));
  }, [saveInstanceUrl, t]);

  const checkDiskSpaceForDownload = useCallback(
    async (path: string, required: number): Promise<boolean> => {
      if (!checkDiskSpace) return true;
      return checkDiskSpace(path, required);
    },
    [checkDiskSpace],
  );

  const handleSelectPipeline = useCallback(
    async (pipelineId: number) => {
      setSelectedPipelineId(pipelineId);
      setSelectedJobs([]);
      setJobsLoading(true);
      try {
        await fetchPipelineJobs(pipelineId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setJobsLoading(false);
      }
    },
    [fetchPipelineJobs],
  );

  const toggleJobSelection = useCallback((job: GitLabJobInfo) => {
    if (!job.hasArtifacts) return;
    setSelectedJobs((prev) => {
      const exists = prev.some((j) => j.id === job.id);
      if (exists) {
        return prev.filter((j) => j.id !== job.id);
      }
      return [...prev, job];
    });
  }, []);

  const handleSelectPackage = useCallback(
    async (packageId: number) => {
      setSelectedPackageId(packageId);
      setSelectedPackageFileIds(new Set());
      setPackageFilesLoading(true);
      try {
        await fetchPackageFiles(packageId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setPackageFilesLoading(false);
      }
    },
    [fetchPackageFiles],
  );

  const togglePackageFileSelection = useCallback((fileId: number) => {
    setSelectedPackageFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (selectedPackageId == null) return;
    const exists = packages.some((pkg) => pkg.id === selectedPackageId);
    if (!exists) {
      setSelectedPackageId(null);
      setSelectedPackageFileIds(new Set());
    }
  }, [packages, selectedPackageId]);

  useEffect(() => {
    if (selectedPackageId == null) {
      setSelectedPackageFileIds(new Set());
      return;
    }

    const availableIds = new Set(packageFiles.map((file) => file.id));
    setSelectedPackageFileIds((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (availableIds.has(id)) {
          next.add(id);
        }
      });
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [packageFiles, selectedPackageId]);

  const applyPackageTypeFilter = useCallback(
    async (filterValue: string) => {
      setSelectedPackageId(null);
      setSelectedPackageFileIds(new Set());
      try {
        const normalizedType = filterValue.trim();
        await fetchPackages(normalizedType || undefined);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [fetchPackages],
  );

  const handleRefreshPackages = useCallback(async () => {
    await applyPackageTypeFilter(packageTypeFilter);
  }, [applyPackageTypeFilter, packageTypeFilter]);

  const handleApplyPackageTypeFilter = useCallback(async () => {
    await applyPackageTypeFilter(packageTypeFilter);
  }, [applyPackageTypeFilter, packageTypeFilter]);

  const handleClearPackageTypeFilter = useCallback(async () => {
    setPackageTypeFilter("");
    await applyPackageTypeFilter("");
  }, [applyPackageTypeFilter]);

  const handlePackageTypeFilterKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      void handleApplyPackageTypeFilter();
    },
    [handleApplyPackageTypeFilter],
  );

  const handleDownload = useCallback(async () => {
    if (!destination.trim()) {
      toast.error(t("downloads.gitlab.noDestination"));
      return;
    }

    setIsDownloading(true);

    try {
      const unknownSizeWarningRef = { current: false };
      const ensurePreflight = async (
        expectedBytes?: number | null,
      ): Promise<boolean> => {
        return runDownloadPreflightWithUi(
          {
            destinationPath: destination,
            expectedBytes,
            checkDiskSpace: checkDiskSpaceForDownload,
          },
          {
            t,
            onInfo: (message) => toast(message),
            onError: (message) => toast.error(message),
            unknownSizeWarningRef,
          },
        );
      };

      if (sourceType === "release" && selectedAssets.length > 0) {
        for (const asset of selectedAssets) {
          const preflightOk = await ensurePreflight();
          if (!preflightOk) {
            return;
          }
          const taskId = await downloadAsset(asset, destination);
          onDownloadStarted?.(taskId);
        }
        toast.success(
          t("downloads.gitlab.assetsAdded", { count: selectedAssets.length }),
        );
      } else if (sourceType === "branch" && selectedBranch) {
        const preflightOk = await ensurePreflight();
        if (!preflightOk) {
          return;
        }
        const taskId = await downloadSource(
          selectedBranch,
          archiveFormat,
          destination,
        );
        onDownloadStarted?.(taskId);
        toast.success(t("downloads.gitlab.sourceAdded"));
      } else if (sourceType === "tag" && selectedTag) {
        const preflightOk = await ensurePreflight();
        if (!preflightOk) {
          return;
        }
        const taskId = await downloadSource(
          selectedTag,
          archiveFormat,
          destination,
        );
        onDownloadStarted?.(taskId);
        toast.success(t("downloads.gitlab.sourceAdded"));
      } else if (sourceType === "pipeline" && selectedJobs.length > 0) {
        const artifactJobs = selectedJobs.filter((job) => job.hasArtifacts);
        if (artifactJobs.length === 0) {
          toast.error(t("downloads.gitlab.noSelection"));
          return;
        }

        for (const job of artifactJobs) {
          const preflightOk = await ensurePreflight();
          if (!preflightOk) {
            return;
          }
          const taskId = await downloadJobArtifacts(job, destination);
          onDownloadStarted?.(taskId);
        }

        toast.success(
          t("downloads.gitlab.artifactsAdded", { count: artifactJobs.length }),
        );
      } else if (
        sourceType === "package" &&
        selectedPackageId != null &&
        selectedPackageFileIds.size > 0
      ) {
        const selectedFiles = packageFiles.filter((file) =>
          selectedPackageFileIds.has(file.id),
        );
        if (selectedFiles.length === 0) {
          toast.error(t("downloads.gitlab.noSelection"));
          return;
        }

        for (const file of selectedFiles) {
          const preflightOk = await ensurePreflight(file.size);
          if (!preflightOk) {
            return;
          }
          const taskId = await downloadPackageFile(
            selectedPackageId,
            file.fileName,
            destination,
          );
          onDownloadStarted?.(taskId);
        }

        toast.success(
          t("downloads.gitlab.packageFilesAdded", { count: selectedFiles.length }),
        );
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
    downloadJobArtifacts,
    checkDiskSpaceForDownload,
    onDownloadStarted,
    handleClose,
    t,
    selectedJobs,
    selectedPackageId,
    selectedPackageFileIds,
    packageFiles,
    downloadPackageFile,
  ]);

  const canDownload =
    destination.trim() &&
    ((sourceType === "release" && selectedAssets.length > 0) ||
      (sourceType === "branch" && selectedBranch) ||
      (sourceType === "tag" && selectedTag) ||
      (sourceType === "pipeline" && selectedJobs.length > 0) ||
      (sourceType === "package" &&
        selectedPackageId != null &&
        selectedPackageFileIds.size > 0));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gitlab className="h-5 w-5" />
            {t("downloads.gitlab.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("downloads.gitlab.dialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Project Input */}
          <RepoValidationInput
            value={projectInput}
            onChange={setProjectInput}
            onValidate={handleValidate}
            isValidating={isValidating}
            isValid={isValid}
            placeholder={t("downloads.gitlab.projectPlaceholder")}
            label={t("downloads.gitlab.project")}
            fetchLabel={t("downloads.gitlab.fetch")}
            validMessage={
              parsedProject && isValid ? (
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
              ) : undefined
            }
          />

          {/* Authentication Section */}
          <Collapsible
            open={showAuth}
            onOpenChange={setShowAuth}
            className="border rounded-md"
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  !showAuth && "-rotate-90",
                )}
              />
              <KeyRound className="h-4 w-4" />
              {t("downloads.auth.title")}
              {(token.trim() || instanceUrl.trim()) && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {t("downloads.auth.configured")}
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  {t("downloads.auth.gitlabHint")}
                </p>
                <div className="space-y-2">
                  <Label className="text-xs">{t("downloads.auth.token")}</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showToken ? "text" : "password"}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={t("downloads.auth.tokenPlaceholder")}
                        className="pr-10 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveToken}
                      disabled={!token.trim() || !isDesktop}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {t("downloads.gitlab.saveToken")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearToken}
                      disabled={!isDesktop}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {t("downloads.gitlab.clearToken")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {t("downloads.auth.instanceUrl")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={instanceUrl}
                      onChange={(e) => setInstanceUrl(e.target.value)}
                      placeholder={t("downloads.auth.instanceUrlPlaceholder")}
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveInstanceUrl}
                      disabled={!isDesktop}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {t("downloads.gitlab.saveInstanceUrl")}
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
              <TabsList className="grid w-full grid-cols-5">
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
                <TabsTrigger value="pipeline" className="gap-2">
                  <Package className="h-4 w-4" />
                  {t("downloads.gitlab.pipelines")}
                  <Badge variant="secondary" className="ml-1">
                    {pipelines.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="package" className="gap-2">
                  <FileArchive className="h-4 w-4" />
                  {t("downloads.gitlab.packages")}
                  <Badge variant="secondary" className="ml-1">
                    {packages.length}
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
                                      handleAssetToggle(asset)
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
                  </TabsContent>

                  {/* Branches Tab */}
                  <TabsContent
                    value="branch"
                    className="flex-1 overflow-hidden mt-2"
                  >
                    <RefListSelector
                      items={branches.map(
                        (branch): RefItem => ({
                          name: branch.name,
                          badges: [
                            ...(branch.default
                              ? [
                                  {
                                    label: t("downloads.gitlab.default"),
                                    variant: "secondary" as const,
                                  },
                                ]
                              : []),
                            ...(branch.protected
                              ? [
                                  {
                                    label: t("downloads.gitlab.protected"),
                                    variant: "outline" as const,
                                  },
                                ]
                              : []),
                          ],
                        }),
                      )}
                      selectedValue={selectedBranch}
                      onSelect={setSelectedBranch}
                      emptyMessage={t("downloads.gitlab.noBranches")}
                      idPrefix="gl-branch"
                    />

                    {selectedBranch && (
                      <ArchiveFormatSelector
                        format={archiveFormat}
                        onFormatChange={(v) =>
                          setArchiveFormat(v as GitLabArchiveFormat)
                        }
                        formats={GITLAB_ARCHIVE_FORMATS}
                        idPrefix="gl-format"
                        label={t("downloads.gitlab.format")}
                      />
                    )}
                  </TabsContent>

                  {/* Tags Tab */}
                  <TabsContent
                    value="tag"
                    className="flex-1 overflow-hidden mt-2"
                  >
                    <RefListSelector
                      items={tags.map(
                        (tag): RefItem => ({
                          name: tag.name,
                          badges: tag.protected
                            ? [
                                {
                                  label: t("downloads.gitlab.protected"),
                                  variant: "outline",
                                },
                              ]
                            : undefined,
                        }),
                      )}
                      selectedValue={selectedTag}
                      onSelect={setSelectedTag}
                      emptyMessage={t("downloads.gitlab.noTags")}
                      idPrefix="gl-tag"
                    />

                    {selectedTag && (
                      <ArchiveFormatSelector
                        format={archiveFormat}
                        onFormatChange={(v) =>
                          setArchiveFormat(v as GitLabArchiveFormat)
                        }
                        formats={GITLAB_ARCHIVE_FORMATS}
                        idPrefix="gl-tag-format"
                        label={t("downloads.gitlab.format")}
                      />
                    )}
                  </TabsContent>

                  {/* Pipelines Tab */}
                  <TabsContent
                    value="pipeline"
                    className="flex-1 overflow-hidden mt-2 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Label>{t("downloads.gitlab.pipelines")}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await fetchPipelines();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : String(err));
                          }
                        }}
                      >
                        {t("common.refresh")}
                      </Button>
                    </div>

                    <ScrollArea className="h-[140px] border rounded-md">
                      {pipelines.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.gitlab.noPipelines")}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {pipelines.map((pipeline) => (
                            <button
                              type="button"
                              key={pipeline.id}
                              className={cn(
                                "w-full text-left p-2 rounded-md border transition-colors",
                                selectedPipelineId === pipeline.id
                                  ? "bg-primary/10 border-primary"
                                  : "hover:bg-muted border-transparent",
                              )}
                              onClick={() => handleSelectPipeline(pipeline.id)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">#{pipeline.id}</span>
                                <Badge variant="outline" className="text-xs">
                                  {pipeline.status}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {pipeline.refName || "—"}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    <Label>{t("downloads.gitlab.jobs")}</Label>
                    <ScrollArea className="h-[160px] border rounded-md">
                      {jobsLoading ? (
                        <div className="p-4 space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : !selectedPipelineId ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.gitlab.selectPipeline")}
                        </div>
                      ) : jobs.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.gitlab.noJobs")}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {jobs.map((job) => {
                            const checked = selectedJobs.some((j) => j.id === job.id);
                            return (
                              <label
                                key={job.id}
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded-md border",
                                  checked
                                    ? "bg-primary/10 border-primary"
                                    : "border-transparent hover:bg-muted",
                                  !job.hasArtifacts && "opacity-60",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={!job.hasArtifacts}
                                  onCheckedChange={() => toggleJobSelection(job)}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{job.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {job.stage || "—"} · {job.status}
                                  </div>
                                </div>
                                <Badge
                                  variant={job.hasArtifacts ? "secondary" : "outline"}
                                  className="text-xs"
                                >
                                  {job.hasArtifacts
                                    ? t("downloads.gitlab.downloadArtifacts")
                                    : t("common.none")}
                                </Badge>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  {/* Packages Tab */}
                  <TabsContent
                    value="package"
                    className="flex-1 overflow-hidden mt-2 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Label>{t("downloads.gitlab.packages")}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshPackages}
                      >
                        {t("common.refresh")}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        value={packageTypeFilter}
                        onChange={(e) => setPackageTypeFilter(e.target.value)}
                        onKeyDown={handlePackageTypeFilterKeyDown}
                        placeholder={t("downloads.gitlab.packageTypePlaceholder")}
                        aria-label={t("downloads.gitlab.packageType")}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleApplyPackageTypeFilter}
                      >
                        {t("downloads.gitlab.applyPackageType")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearPackageTypeFilter}
                        disabled={!packageTypeFilter.trim()}
                      >
                        {t("common.clear")}
                      </Button>
                    </div>

                    <ScrollArea className="h-[140px] border rounded-md">
                      {packages.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.gitlab.noPackages")}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {packages.map((pkg) => (
                            <button
                              type="button"
                              key={pkg.id}
                              className={cn(
                                "w-full text-left p-2 rounded-md border transition-colors",
                                selectedPackageId === pkg.id
                                  ? "bg-primary/10 border-primary"
                                  : "hover:bg-muted border-transparent",
                              )}
                              onClick={() => handleSelectPackage(pkg.id)}
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
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    <Label>{t("downloads.gitlab.packageFiles")}</Label>
                    <ScrollArea className="h-[160px] border rounded-md">
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
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded-md border",
                                  checked
                                    ? "bg-primary/10 border-primary"
                                    : "border-transparent hover:bg-muted",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => togglePackageFileSelection(file.id)}
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
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}

          {/* Destination */}
          {isValid && (
            <DestinationPicker
              value={destination}
              onChange={setDestination}
              placeholder={t("downloads.gitlab.destinationPlaceholder")}
              label={t("downloads.gitlab.destination")}
              isDesktop={isDesktop}
              browseTooltip={t("downloads.browseFolder")}
              errorMessage={t("downloads.gitlab.folderPickerError")}
              mode="directory"
            />
          )}
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

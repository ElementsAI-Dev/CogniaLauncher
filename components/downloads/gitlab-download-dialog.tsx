"use client";

import {
  useState,
  useCallback,
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocale } from "@/components/providers/locale-provider";
import { useGitLabDownloads } from "@/hooks/use-gitlab-downloads";
import { isTauri } from "@/lib/tauri";
import { GITLAB_ARCHIVE_FORMATS } from "@/lib/constants/downloads";
import { runDownloadPreflightWithUi } from "@/lib/downloads";
import { toast } from "sonner";
import { RepoValidationInput } from "./repo-validation-input";
import { DestinationPicker } from "./destination-picker";
import { RefListSelector, type RefItem } from "./ref-list-selector";
import { ArchiveFormatSelector } from "./archive-format-selector";
import { GitLabReleasesTab } from "./gitlab-releases-tab";
import { GitLabPipelinesTab } from "./gitlab-pipelines-tab";
import { GitLabPackagesTab } from "./gitlab-packages-tab";
import { AuthSection } from "./auth-section";
import {
  Loader2,
  Download,
  Tag,
  GitBranch,
  Package,
  AlertCircle,
  FileArchive,
  Star,
  Gitlab,
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
            checkDiskSpace: checkDiskSpace ?? (async () => true),
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
    checkDiskSpace,
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
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-2xl flex flex-col">
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
            onValidate={validateAndFetch}
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
          <AuthSection
            token={token}
            onTokenChange={setToken}
            onSave={handleSaveToken}
            onClear={handleClearToken}
            saveDisabled={!token.trim() || !isDesktop}
            clearDisabled={!isDesktop}
            saveLabel={t("downloads.gitlab.saveToken")}
            clearLabel={t("downloads.gitlab.clearToken")}
            hint={t("downloads.auth.gitlabHint")}
            configured={!!(token.trim() || instanceUrl.trim())}
            instanceUrl={instanceUrl}
            onInstanceUrlChange={setInstanceUrl}
            onSaveInstanceUrl={handleSaveInstanceUrl}
            instanceUrlLabel={t("downloads.auth.instanceUrl")}
            instanceUrlSaveLabel={t("downloads.gitlab.saveInstanceUrl")}
            instanceUrlSaveDisabled={!isDesktop}
            t={t}
          />

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
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
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
                    <GitLabReleasesTab
                      releases={releases}
                      selectedRelease={selectedRelease}
                      onSelectRelease={(tagName) => {
                        setSelectedRelease(tagName);
                        setSelectedAssets([]);
                      }}
                      selectedAssets={selectedAssets}
                      onAssetToggle={handleAssetToggle}
                      t={t}
                    />
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
                    <GitLabPipelinesTab
                      pipelines={pipelines}
                      selectedPipelineId={selectedPipelineId}
                      onSelectPipeline={handleSelectPipeline}
                      jobs={jobs}
                      selectedJobs={selectedJobs}
                      onToggleJob={toggleJobSelection}
                      jobsLoading={jobsLoading}
                      onRefresh={fetchPipelines}
                      t={t}
                    />
                  </TabsContent>

                  {/* Packages Tab */}
                  <TabsContent
                    value="package"
                    className="flex-1 overflow-hidden mt-2 space-y-3"
                  >
                    <GitLabPackagesTab
                      packages={packages}
                      selectedPackageId={selectedPackageId}
                      onSelectPackage={handleSelectPackage}
                      packageFiles={packageFiles}
                      selectedPackageFileIds={selectedPackageFileIds}
                      onToggleFile={togglePackageFileSelection}
                      packageFilesLoading={packageFilesLoading}
                      packageTypeFilter={packageTypeFilter}
                      onFilterChange={setPackageTypeFilter}
                      onApplyFilter={handleApplyPackageTypeFilter}
                      onClearFilter={handleClearPackageTypeFilter}
                      onFilterKeyDown={handlePackageTypeFilterKeyDown}
                      t={t}
                    />
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

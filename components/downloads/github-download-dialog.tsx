"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocale } from "@/components/providers/locale-provider";
import { useGitHubDownloads } from "@/hooks/use-github-downloads";
import {
  useAssetMatcher,
  getPlatformLabel,
  getArchLabel,
  type ParsedAsset,
} from "@/hooks/use-asset-matcher";
import { isTauri } from "@/lib/tauri";
import { GITHUB_ARCHIVE_FORMATS } from "@/lib/constants/downloads";
import {
  createArtifactProfilePreview,
  runDownloadPreflightWithUi,
} from "@/lib/downloads";
import { toast } from "sonner";
import { RepoValidationInput } from "./repo-validation-input";
import { DestinationPicker } from "./destination-picker";
import { RefListSelector, type RefItem } from "./ref-list-selector";
import { ArchiveFormatSelector } from "./archive-format-selector";
import { AuthSection } from "./auth-section";
import {
  SelectableCardButton,
  selectableCheckboxRowClass,
} from "./selectable-list-patterns";
import {
  Github,
  Loader2,
  Download,
  Tag,
  GitBranch,
  Package,
  AlertCircle,
  FileArchive,
  Calendar,
  Star,
  FileText,
  ChevronDown,
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
  checkDiskSpace?: (path: string, required: number) => Promise<boolean>;
}

export function GitHubDownloadDialog({
  open,
  onOpenChange,
  onDownloadStarted,
  checkDiskSpace,
}: GitHubDownloadDialogProps) {
  const { t } = useLocale();
  const isDesktop = isTauri();

  const {
    repoInput,
    setRepoInput,
    token,
    setToken,
    parsedRepo,
    repoInfo,
    isValidating,
    isValid,
    sourceType,
    setSourceType,
    branches,
    tags,
    releases,
    workflowArtifacts,
    loading,
    error,
    tokenStatus,
    vaultStatus,
    vaultPassword,
    setVaultPassword,
    setupVault,
    unlockVault,
    lockVault,
    validateAndFetch,
    downloadAsset,
    downloadSource,
    downloadWorkflowArtifact,
    saveToken,
    clearSavedToken,
    reset,
  } = useGitHubDownloads();

  const { parseAssets, currentPlatform, currentArch, getRecommendedAsset } =
    useAssetMatcher();

  const [destination, setDestination] = useState("");
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<GitHubAssetInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedWorkflowArtifactId, setSelectedWorkflowArtifactId] = useState<number | null>(null);
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

  const selectedWorkflowArtifact = useMemo(() => {
    return workflowArtifacts.find((artifact) => artifact.id === selectedWorkflowArtifactId) ?? null;
  }, [workflowArtifacts, selectedWorkflowArtifactId]);

  const handleClose = useCallback(() => {
    reset();
    setDestination("");
    setSelectedRelease(null);
    setSelectedAssets([]);
    setSelectedBranch(null);
    setSelectedTag(null);
    setSelectedWorkflowArtifactId(null);
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const handleAssetToggle = useCallback((asset: GitHubAssetInfo) => {
    setSelectedAssets((prev) => {
      const exists = prev.find((a) => a.id === asset.id);
      if (exists) {
        return prev.filter((a) => a.id !== asset.id);
      }
      return [...prev, asset];
    });
  }, []);

  const handleSelectRecommended = useCallback(() => {
    if (!currentRelease) return;
    const rec = getRecommendedAsset(currentRelease.assets);
    if (rec) setSelectedAssets([rec]);
  }, [currentRelease, getRecommendedAsset]);

  const handleSaveToken = useCallback(async () => {
    try {
      await saveToken();
      toast.success(t("downloads.github.tokenSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [saveToken, t]);

  const handleClearToken = useCallback(async () => {
    try {
      await clearSavedToken();
      toast.success(t("downloads.github.tokenCleared"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [clearSavedToken, t]);

  const handleSetupVault = useCallback(async () => {
    try {
      await setupVault();
      toast.success(t("downloads.auth.vaultReady"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [setupVault, t]);

  const handleUnlockVault = useCallback(async () => {
    try {
      await unlockVault();
      toast.success(t("downloads.auth.vaultReady"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [t, unlockVault]);

  const handleLockVault = useCallback(async () => {
    try {
      await lockVault();
      toast.success(t("downloads.auth.vaultLocked"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [lockVault, t]);

  const handleDownload = useCallback(async () => {
    if (!destination.trim()) {
      toast.error(t("downloads.github.noDestination"));
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
          const preflightOk = await ensurePreflight(asset.size);
          if (!preflightOk) {
            return;
          }
          const taskId = await downloadAsset(asset, destination);
          onDownloadStarted?.(taskId);
        }
        toast.success(
          t("downloads.github.assetsAdded", { count: selectedAssets.length }),
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
        toast.success(t("downloads.github.sourceAdded"));
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
        toast.success(t("downloads.github.sourceAdded"));
      } else if (sourceType === "workflow" && selectedWorkflowArtifact) {
        const preflightOk = await ensurePreflight(selectedWorkflowArtifact.sizeInBytes);
        if (!preflightOk) {
          return;
        }
        const taskId = await downloadWorkflowArtifact(
          selectedWorkflowArtifact,
          destination,
        );
        onDownloadStarted?.(taskId);
        toast.success(t("downloads.github.assetsAdded", { count: 1 }));
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
    selectedWorkflowArtifact,
    archiveFormat,
    downloadAsset,
    downloadSource,
    downloadWorkflowArtifact,
    checkDiskSpace,
    onDownloadStarted,
    handleClose,
    t,
  ]);

  const canDownload =
    destination.trim() &&
    ((sourceType === "release" && selectedAssets.length > 0) ||
      (sourceType === "branch" && selectedBranch) ||
      (sourceType === "tag" && selectedTag) ||
      (sourceType === "workflow" && selectedWorkflowArtifact));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-2xl flex flex-col">
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
          <RepoValidationInput
            value={repoInput}
            onChange={setRepoInput}
            onValidate={validateAndFetch}
            isValidating={isValidating}
            isValid={isValid}
            placeholder={t("downloads.github.repoPlaceholder")}
            label={t("downloads.github.repository")}
            fetchLabel={t("downloads.github.fetch")}
            validMessage={
              parsedRepo && isValid ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>
                      {t("downloads.github.repoValid")}:{" "}
                      <code>{parsedRepo.fullName}</code>
                    </span>
                    {repoInfo && (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repoInfo.stargazersCount.toLocaleString()}
                        </span>
                        {repoInfo.license && (
                          <Badge variant="outline" className="text-xs">
                            {repoInfo.license}
                          </Badge>
                        )}
                        {repoInfo.archived && (
                          <Badge variant="destructive" className="text-xs">
                            {t("downloads.github.archived")}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  {repoInfo?.description && (
                    <p className="text-xs">{repoInfo.description}</p>
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
            saveLabel={t("downloads.github.saveToken")}
            clearLabel={t("downloads.github.clearToken")}
            hint={t("downloads.auth.githubHint")}
            configured={!!token.trim() || !!tokenStatus?.configured}
            tokenStatus={tokenStatus}
            vaultStatus={vaultStatus}
            vaultPassword={vaultPassword}
            onVaultPasswordChange={setVaultPassword}
            onSetupVault={handleSetupVault}
            onUnlockVault={handleUnlockVault}
            onLockVault={handleLockVault}
            vaultActionDisabled={!isDesktop || !vaultPassword.trim()}
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
              onValueChange={(v) => setSourceType(v as GitHubSourceType)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
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
                <TabsTrigger value="workflow" className="gap-2">
                  <FileArchive className="h-4 w-4" />
                  {t("downloads.github.workflowArtifacts")}
                  <Badge variant="secondary" className="ml-1">
                    {workflowArtifacts.length}
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
                    <ScrollArea className="h-50 border rounded-md">
                      {releases.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.github.noReleases")}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {releases.map((release) => (
                            <SelectableCardButton
                              key={release.id}
                              selected={selectedRelease === release.tagName}
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
                                  {release.draft && (
                                    <Badge variant="destructive">
                                      {t("downloads.github.draft")}
                                    </Badge>
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
                            </SelectableCardButton>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    {/* Release Notes */}
                    {currentRelease?.body && (
                      <Collapsible className="mt-2">
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronDown className="h-4 w-4" />
                          <FileText className="h-4 w-4" />
                          {t("downloads.github.releaseNotes")}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="text-xs whitespace-pre-wrap max-h-30 overflow-auto p-2 bg-muted rounded-md mt-1">
                            {currentRelease.body}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Asset Selection */}
                    {currentRelease && parsedAssets.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label>{t("downloads.github.selectAssets")}</Label>
                          {currentPlatform !== "unknown" && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleSelectRecommended}
                              >
                                <Star className="h-3 w-3 mr-1" />
                                {t("downloads.github.selectRecommended")}
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {getPlatformLabel(currentPlatform)}{" "}
                                {getArchLabel(currentArch)}
                              </span>
                            </div>
                          )}
                        </div>
                        <ScrollArea className="h-35 border rounded-md">
                          <div className="p-2 space-y-1">
                            {parsedAssets.map(
                              ({
                                asset,
                                platform,
                                arch,
                                isRecommended,
                                isFallback,
                              }) => {
                                const isSelected = !!selectedAssets.find(
                                  (a) => a.id === asset.id,
                                );
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
                                        handleAssetToggle(asset)
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
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
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
                                      {asset.downloadCount != null &&
                                        asset.downloadCount > 0 && (
                                          <span className="text-xs text-muted-foreground">
                                            {"\u2193"}{" "}
                                            {asset.downloadCount.toLocaleString()}
                                          </span>
                                        )}
                                      <span className="text-xs text-muted-foreground">
                                        {asset.sizeHuman}
                                      </span>
                                    </div>
                                  </label>
                                );
                              },
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
                    <RefListSelector
                      items={branches.map(
                        (branch): RefItem => ({
                          name: branch.name,
                          badges: branch.protected
                            ? [
                                {
                                  label: t("downloads.github.protected"),
                                  variant: "outline",
                                },
                              ]
                            : undefined,
                        }),
                      )}
                      selectedValue={selectedBranch}
                      onSelect={setSelectedBranch}
                      emptyMessage={t("downloads.github.noBranches")}
                      idPrefix="branch"
                    />

                    {selectedBranch && (
                      <ArchiveFormatSelector
                        format={archiveFormat}
                        onFormatChange={(v) =>
                          setArchiveFormat(v as GitHubArchiveFormat)
                        }
                        formats={GITHUB_ARCHIVE_FORMATS}
                        idPrefix="format"
                        label={t("downloads.github.format")}
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
                        }),
                      )}
                      selectedValue={selectedTag}
                      onSelect={setSelectedTag}
                      emptyMessage={t("downloads.github.noTags")}
                      idPrefix="tag"
                    />

                    {selectedTag && (
                      <ArchiveFormatSelector
                        format={archiveFormat}
                        onFormatChange={(v) =>
                          setArchiveFormat(v as GitHubArchiveFormat)
                        }
                        formats={GITHUB_ARCHIVE_FORMATS}
                        idPrefix="tag-format"
                        label={t("downloads.github.format")}
                      />
                    )}
                  </TabsContent>

                  <TabsContent
                    value="workflow"
                    className="flex-1 overflow-hidden mt-2"
                  >
                    <ScrollArea className="h-50 border rounded-md">
                      {workflowArtifacts.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t("downloads.github.noWorkflowArtifacts")}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {workflowArtifacts.map((artifact) => (
                            (() => {
                              const profile = createArtifactProfilePreview({
                                fileName: artifact.name,
                                sourceKind: "github_workflow_artifact",
                              });
                              return (
                            <SelectableCardButton
                              key={artifact.id}
                              selected={selectedWorkflowArtifactId === artifact.id}
                              onClick={() => setSelectedWorkflowArtifactId(artifact.id)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{artifact.name}</div>
                                <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                                  {artifact.workflowRunNumber != null && (
                                    <span>#{artifact.workflowRunNumber}</span>
                                  )}
                                  {artifact.workflowRunBranch && (
                                    <span>{artifact.workflowRunBranch}</span>
                                  )}
                                </div>
                              </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                  <Badge variant="outline" className="text-xs">
                                    {t(`downloads.artifactKind.${profile.artifactKind}`)}
                                  </Badge>
                                  {artifact.sizeHuman}
                                </div>
                              </div>
                            </SelectableCardButton>
                              );
                            })()
                          ))}
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
              placeholder={t("downloads.github.destinationPlaceholder")}
              label={t("downloads.github.destination")}
              isDesktop={isDesktop}
              browseTooltip={t("downloads.browseFolder")}
              errorMessage={t("downloads.github.folderPickerError")}
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
            {t("downloads.github.addToQueue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

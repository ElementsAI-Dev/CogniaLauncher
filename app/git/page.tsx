"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useGit } from "@/hooks/git/use-git";
import { useGitAdvanced } from "@/hooks/git/use-git-advanced";
import { useGitLfs } from "@/hooks/git/use-git-lfs";
import { useLocale } from "@/components/providers/locale-provider";
import { isTauri, revealPath } from "@/lib/tauri";
import { writeClipboard } from "@/lib/clipboard";
import {
  createDefaultGitWorkbenchPanelsState,
  type GitWorkbenchPanelId,
  type GitWorkbenchPanelsState,
  type GitWorkbenchTab,
  useGitRepoStore,
} from "@/lib/stores/git";
import { runEditorActionFlow } from "@/lib/editor-action";
import { GitNotAvailable, GitStatsStrip } from "@/components/git";
import {
  GitTabContext,
  GitOverviewTab,
  GitRepositoryTab,
  GitGraphTab,
  GitHistoryTab,
  GitChangesTab,
  GitToolsTab,
  GitAdvancedTab,
  GitOperationsTab,
} from "@/components/git/tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  RefreshCw,
  FolderOpen,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type {
  EditorCapabilityProbeResult,
  EditorOpenActionResult,
  GitCommitDetail as GitCommitDetailType,
  GitSupportFeature,
  GitSupportFeatureKey,
} from "@/types/tauri";
import type {
  GitConfigApplyPlanItem,
  GitConfigApplySummary,
} from "@/types/git";

function normalizeEditorOpenReason(
  reason: string,
): EditorOpenActionResult["reason"] {
  switch (reason) {
    case "ok":
    case "editor_not_found":
    case "config_not_found":
    case "editor_launch_failed":
    case "fallback_failed":
    case "runtime_error":
      return reason;
    default:
      return "runtime_error";
  }
}

const WORKBENCH_PANELS_BY_TAB: Partial<
  Record<GitWorkbenchTab, GitWorkbenchPanelId[]>
> = {
  graph: ["graphDetail"],
  history: ["historyDetail"],
  changes: ["changesInspector"],
  tools: ["toolsWorkspace"],
  advanced: ["advancedWorkspace"],
  operations: ["operationsWorkspace"],
};

export default function GitPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const git = useGit();
  const gitAdvanced = useGitAdvanced(git.repoPath);
  const gitLfs = useGitLfs(git.repoPath);
  const repoStore = useGitRepoStore();
  const {
    repoPath,
    aheadBehind,
    supportSnapshot,
    refreshAll,
    refreshByScopes: refreshGitByScopes,
    refreshSupportSnapshot,
    getConfigFilePath,
    probeConfigEditor,
    setRepoPath,
    getCommitDetail,
  } = git;
  const {
    refreshSubmodules,
    refreshWorktrees,
    refreshHooks,
    refreshMergeRebaseState,
    refreshConflictedFiles,
    refreshLocalConfig,
    refreshRepoStats,
    refreshBisectState,
    refreshSparseCheckout,
    refreshByScopes: refreshAdvancedByScopes,
  } = gitAdvanced;
  const {
    checkAvailability: checkLfsAvailability,
    refreshTrackedPatterns,
    refreshLfsFiles,
  } = gitLfs;

  const initializedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<GitWorkbenchTab>("overview");
  const [workbenchPanels, setWorkbenchPanels] =
    useState<GitWorkbenchPanelsState>(createDefaultGitWorkbenchPanelsState);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(
    null,
  );
  const [commitDetail, setCommitDetail] = useState<GitCommitDetailType | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [diffContent, setDiffContent] = useState<string>("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [compareFrom, setCompareFrom] = useState("");
  const [compareTo, setCompareTo] = useState("");
  const [contextLines, setContextLines] = useState<number | undefined>(
    undefined,
  );
  const [configFilePath, setConfigFilePath] = useState<string | null>(null);
  const [configEditorCapability, setConfigEditorCapability] =
    useState<EditorCapabilityProbeResult | null>(null);

  // --- Core callbacks ---

  const runAction = useCallback(
    async <T,>(
      action: () => Promise<T>,
      options?: {
        successKey?: string;
        successDescription?: boolean;
        onSuccess?: (result: T) => Promise<void> | void;
      },
    ): Promise<T> => {
      try {
        const result = await action();
        if (options?.successKey) {
          const description =
            options.successDescription && typeof result === "string"
              ? { description: result }
              : undefined;
          toast.success(t(options.successKey), description);
        }
        await options?.onSuccess?.(result);
        return result;
      } catch (e) {
        toast.error(String(e));
        throw e;
      }
    },
    [t],
  );

  const refreshAdvancedData = useCallback(async () => {
    if (!repoPath) return;
    await Promise.allSettled([
      refreshSubmodules(),
      refreshWorktrees(),
      refreshHooks(),
      refreshMergeRebaseState(),
      refreshConflictedFiles(),
      refreshLocalConfig(),
      refreshRepoStats(),
      refreshBisectState(),
      refreshSparseCheckout(),
    ]);
  }, [
    repoPath,
    refreshSubmodules,
    refreshWorktrees,
    refreshHooks,
    refreshMergeRebaseState,
    refreshConflictedFiles,
    refreshLocalConfig,
    refreshRepoStats,
    refreshBisectState,
    refreshSparseCheckout,
  ]);

  const refreshLfsData = useCallback(async () => {
    if (!repoPath) return;
    await Promise.allSettled([
      checkLfsAvailability(),
      refreshTrackedPatterns(),
      refreshLfsFiles(),
    ]);
  }, [repoPath, checkLfsAvailability, refreshTrackedPatterns, refreshLfsFiles]);

  const refreshRepoData = useCallback(() => {
    void refreshGitByScopes([
      "repoInfo",
      "status",
      "branches",
      "remotes",
      "tags",
      "stashes",
      "log",
      "graph",
      "aheadBehind",
    ]);
    void refreshSupportSnapshot(repoPath);
    void refreshAdvancedByScopes(["advanced"]);
    void refreshLfsData();
  }, [
    repoPath,
    refreshGitByScopes,
    refreshSupportSnapshot,
    refreshAdvancedByScopes,
    refreshLfsData,
  ]);

  const refreshAfterGraphWrite = useCallback(async () => {
    await refreshGitByScopes([
      "repoInfo",
      "status",
      "branches",
      "tags",
      "log",
      "graph",
      "aheadBehind",
    ]);
    await refreshAdvancedByScopes(["advanced"]);
    await refreshSupportSnapshot(repoPath);
  }, [
    repoPath,
    refreshGitByScopes,
    refreshAdvancedByScopes,
    refreshSupportSnapshot,
  ]);

  // --- Workbench panel management ---

  const restoreWorkbenchForPath = useCallback(
    (path: string | null | undefined) => {
      if (!path) {
        setActiveTab("overview");
        setWorkbenchPanels(createDefaultGitWorkbenchPanelsState());
        return;
      }
      const preference = repoStore.getWorkbenchPreference(path);
      setActiveTab(preference.activeTab);
      setWorkbenchPanels(preference.panels);
    },
    [repoStore],
  );

  const handleActiveTabChange = useCallback(
    (nextTab: string) => {
      const normalizedTab = nextTab as GitWorkbenchTab;
      setActiveTab(normalizedTab);
      if (repoPath) {
        repoStore.setWorkbenchActiveTab(repoPath, normalizedTab);
      }
    },
    [repoPath, repoStore],
  );

  const setWorkbenchPanelCollapsed = useCallback(
    (panelId: GitWorkbenchPanelId, collapsed: boolean) => {
      setWorkbenchPanels((current) => ({
        ...current,
        [panelId]: { ...current[panelId], collapsed },
      }));
      if (repoPath) {
        repoStore.setWorkbenchPanelCollapsed(repoPath, panelId, collapsed);
      }
    },
    [repoPath, repoStore],
  );

  const hideWorkbenchPanel = useCallback(
    (panelId: GitWorkbenchPanelId) => {
      setWorkbenchPanels((current) => ({
        ...current,
        [panelId]: { ...current[panelId], hidden: true },
      }));
      if (repoPath) {
        repoStore.hideWorkbenchPanel(repoPath, panelId);
      }
    },
    [repoPath, repoStore],
  );

  const restoreWorkbenchPanel = useCallback(
    (panelId: GitWorkbenchPanelId) => {
      setWorkbenchPanels((current) => ({
        ...current,
        [panelId]: { ...current[panelId], hidden: false },
      }));
      if (repoPath) {
        repoStore.restoreWorkbenchPanel(repoPath, panelId);
      }
    },
    [repoPath, repoStore],
  );

  const restoreAllWorkbenchPanels = useCallback(() => {
    setWorkbenchPanels((current) => {
      const next = { ...current };
      for (const panelId of Object.keys(next) as GitWorkbenchPanelId[]) {
        next[panelId] = { ...next[panelId], hidden: false };
      }
      return next;
    });
    if (repoPath) {
      repoStore.restoreAllWorkbenchPanels(repoPath);
    }
  }, [repoPath, repoStore]);

  const ensureWorkbenchPanelVisible = useCallback(
    (panelId: GitWorkbenchPanelId) => {
      if (!workbenchPanels[panelId]?.hidden) return;
      restoreWorkbenchPanel(panelId);
    },
    [restoreWorkbenchPanel, workbenchPanels],
  );

  const selectCommitInWorkbench = useCallback(
    async (hash: string, preferredTab: "graph" | "history") => {
      ensureWorkbenchPanelVisible(
        preferredTab === "graph" ? "graphDetail" : "historyDetail",
      );
      if (activeTab !== preferredTab) {
        handleActiveTabChange(preferredTab);
      }
      setSelectedCommitHash(hash);
      setDetailLoading(true);
      try {
        const detail = await getCommitDetail(hash);
        setCommitDetail(detail);
      } finally {
        setDetailLoading(false);
      }
    },
    [
      activeTab,
      ensureWorkbenchPanelVisible,
      getCommitDetail,
      handleActiveTabChange,
    ],
  );

  // --- Support feature gating ---

  const supportByFeature = useMemo<
    Partial<Record<GitSupportFeatureKey, GitSupportFeature>>
  >(() => {
    const map: Partial<Record<GitSupportFeatureKey, GitSupportFeature>> = {};
    for (const feature of supportSnapshot?.features ?? []) {
      map[feature.key as GitSupportFeatureKey] = feature;
    }
    return map;
  }, [supportSnapshot]);

  const getSupportReason = useCallback(
    (featureKey: GitSupportFeatureKey): string | null => {
      const feature = supportByFeature[featureKey];
      if (!feature || feature.supported) return null;
      const parts: string[] = [];
      if (feature.reason?.trim()) parts.push(feature.reason.trim());
      const guidance = feature.nextSteps
        .map((step) => step.trim())
        .filter(Boolean)
        .join(" ");
      if (guidance) parts.push(guidance);
      if (parts.length === 0) {
        parts.push(
          feature.status === "unknown"
            ? "Support status is unknown. Refresh support snapshot and retry."
            : "This operation is unavailable in the current Git runtime.",
        );
      }
      return parts.join(" ");
    },
    [supportByFeature],
  );

  const ensureFeatureSupported = useCallback(
    (featureKey: GitSupportFeatureKey) => {
      const reason = getSupportReason(featureKey);
      if (!reason) return;
      throw new Error(reason);
    },
    [getSupportReason],
  );

  // --- Config operation handlers ---

  const handleSetConfig = useCallback(
    async (key: string, value: string) => {
      try {
        await runAction(() => git.setConfigValue(key, value), {
          successKey: "git.config.saved",
        });
      } catch {
        // handled by runAction
      }
    },
    [git, runAction],
  );

  const handleRemoveConfig = useCallback(
    async (key: string) => {
      try {
        await runAction(() => git.removeConfigKey(key), {
          successKey: "git.config.removed",
        });
      } catch {
        // handled by runAction
      }
    },
    [git, runAction],
  );

  const handleOpenInEditor = useCallback(async (): Promise<EditorOpenActionResult> => {
    try {
      const flow = await runEditorActionFlow({
        probe: async () => {
          const result = await probeConfigEditor();
          setConfigEditorCapability(result);
          return {
            available: result.available,
            reason: result.reason,
            fallbackPath: result.configPath,
          };
        },
        open: async () => {
          const result = await git.openConfigInEditor();
          return {
            ...result,
            fallbackPath: result.fallbackPath ?? configFilePath,
          };
        },
        fallbackOpen: async (path: string) => {
          await revealPath(path);
        },
        unavailableMessage: t("git.config.editorUnavailable"),
      });

      if (flow.status === "opened") {
        toast.success(flow.message);
      } else if (flow.status === "fallback_opened") {
        toast.info(t("git.config.openedFallback"));
      } else if (flow.status === "unavailable") {
        toast.error(t("git.config.editorUnavailable"));
      } else {
        toast.error(flow.message);
      }

      return (
        flow.openResult ?? {
          success: flow.status === "fallback_opened",
          kind:
            flow.status === "fallback_opened"
              ? "fallback_opened"
              : "unavailable",
          reason: normalizeEditorOpenReason(flow.probe.reason),
          message: flow.message,
          openedWith: flow.status === "fallback_opened" ? "default" : null,
          fallbackUsed: flow.status === "fallback_opened",
          fallbackPath: flow.probe.fallbackPath ?? null,
        }
      );
    } catch (e) {
      const message = String(e);
      toast.error(message);
      return {
        success: false,
        kind: "error",
        reason: "runtime_error",
        message,
        openedWith: null,
        fallbackUsed: false,
        fallbackPath: configFilePath,
      };
    }
  }, [configFilePath, git, probeConfigEditor, runEditorActionFlow, t]);

  const handleOpenConfigLocation = useCallback(async (): Promise<void> => {
    if (!configFilePath) return;
    try {
      await revealPath(configFilePath);
      toast.success(t("git.config.openedFallback"));
    } catch (e) {
      toast.error(String(e));
    }
  }, [configFilePath, t]);

  const handleApplyConfigPlan = useCallback(
    async (
      items: GitConfigApplyPlanItem[],
    ): Promise<GitConfigApplySummary> => {
      return await runAction(() => git.applyConfigPlan(items), {
        onSuccess: async () => {
          await git.refreshConfig();
          const capability = await probeConfigEditor();
          setConfigEditorCapability(capability);
        },
      });
    },
    [git, probeConfigEditor, runAction],
  );

  // --- Hidden panels ---

  const hiddenPanelsForActiveTab = useMemo(() => {
    const panelIds = WORKBENCH_PANELS_BY_TAB[activeTab] ?? [];
    return panelIds.filter((panelId) => workbenchPanels[panelId]?.hidden);
  }, [activeTab, workbenchPanels]);

  const getWorkbenchPanelLabel = useCallback(
    (panelId: GitWorkbenchPanelId) => {
      switch (panelId) {
        case "graphDetail":
          return t("git.workbench.panels.graphDetail");
        case "historyDetail":
          return t("git.workbench.panels.historyDetail");
        case "changesInspector":
          return t("git.workbench.panels.changesInspector");
        case "toolsWorkspace":
          return t("git.workbench.panels.toolsWorkspace");
        case "advancedWorkspace":
          return t("git.workbench.panels.advancedWorkspace");
        case "operationsWorkspace":
          return t("git.workbench.panels.operationsWorkspace");
        default:
          return panelId;
      }
    },
    [t],
  );

  // --- Effects ---

  useEffect(() => {
    if (!initializedRef.current && isDesktop) {
      initializedRef.current = true;
      refreshAll().then(() => {
        getConfigFilePath()
          .then(setConfigFilePath)
          .catch(() => {});
        probeConfigEditor()
          .then(setConfigEditorCapability)
          .catch(() => {});
        if (repoStore.lastRepoPath) {
          setRepoPath(repoStore.lastRepoPath).catch(() => {});
        }
      });
    }
  }, [
    getConfigFilePath,
    isDesktop,
    probeConfigEditor,
    refreshAll,
    repoStore.lastRepoPath,
    setRepoPath,
  ]);

  useEffect(() => {
    if (!isDesktop) return;
    restoreWorkbenchForPath(repoPath);
  }, [isDesktop, repoPath, restoreWorkbenchForPath]);

  useEffect(() => {
    if (!repoPath) {
      refreshSupportSnapshot(null).catch(() => {});
      return;
    }
    refreshGitByScopes([
      "repoInfo",
      "status",
      "branches",
      "remotes",
      "tags",
      "stashes",
      "log",
      "graph",
      "aheadBehind",
    ]).catch(() => {});
    refreshSupportSnapshot(repoPath).catch(() => {});
    refreshAdvancedByScopes(["advanced"]).catch(() => {});
    refreshLfsData().catch(() => {});
  }, [
    repoPath,
    refreshGitByScopes,
    refreshSupportSnapshot,
    refreshAdvancedByScopes,
    refreshLfsData,
  ]);

  // --- Non-desktop fallback ---

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title={t("git.title")} description={t("git.description")} />
        <GitNotAvailable />
      </div>
    );
  }

  // --- Context value ---

  const changesCount = git.statusFiles.length;

  const contextValue = {
    git,
    gitAdvanced,
    gitLfs,
    repoStore: {
      addRecentRepo: repoStore.addRecentRepo,
      addCloneHistory: repoStore.addCloneHistory,
      clearCloneHistory: repoStore.clearCloneHistory,
      cloneHistory: repoStore.cloneHistory,
    },
    runAction,
    workbenchPanels,
    setWorkbenchPanelCollapsed,
    hideWorkbenchPanel,
    restoreWorkbenchPanel,
    ensureWorkbenchPanelVisible,
    refreshRepoData,
    refreshAfterGraphWrite,
    refreshAdvancedData,
    refreshLfsData,
    selectedCommitHash,
    setSelectedCommitHash,
    commitDetail,
    setCommitDetail,
    detailLoading,
    selectCommitInWorkbench,
    diffContent,
    setDiffContent,
    diffLoading,
    setDiffLoading,
    compareFrom,
    setCompareFrom,
    compareTo,
    setCompareTo,
    contextLines,
    setContextLines,
    supportByFeature,
    getSupportReason,
    ensureFeatureSupported,
    configFilePath,
    configEditorCapability,
    setConfigEditorCapability,
    activeTab,
    handleActiveTabChange,
    handleSetConfig,
    handleRemoveConfig,
    handleOpenInEditor,
    handleOpenConfigLocation,
    handleApplyConfigPlan,
  };

  // --- Render ---

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("git.title")}
        description={t("git.description")}
        actions={
          git.repoPath ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={refreshRepoData}
                    disabled={git.loading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${git.loading ? "animate-spin" : ""}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.refresh")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => revealPath(git.repoPath!)}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("git.header.openFolder")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={async () => {
                      await writeClipboard(git.repoPath!);
                      toast.success(t("git.header.copyPath"));
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("git.header.copyPath")}</TooltipContent>
              </Tooltip>
            </>
          ) : undefined
        }
      />

      {git.repoInfo && (
        <GitStatsStrip
          repoInfo={git.repoInfo}
          aheadBehind={aheadBehind}
          statusFiles={git.statusFiles}
          commits={git.commits}
          stashes={git.stashes}
          branches={git.branches}
          loading={git.loading}
        />
      )}

      {git.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{git.error}</AlertDescription>
        </Alert>
      )}

      <GitTabContext.Provider value={contextValue}>
        <Tabs value={activeTab} onValueChange={handleActiveTabChange}>
          <TabsList>
            <TabsTrigger value="overview">{t("git.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="repository" disabled={!git.available}>
              {t("git.tabs.repository")}
              {git.stashes.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                  {git.stashes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="graph" disabled={!git.available || !git.repoPath}>
              {t("git.tabs.graph")}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              disabled={!git.available || !git.repoPath}
            >
              {t("git.tabs.history")}
            </TabsTrigger>
            <TabsTrigger
              value="changes"
              disabled={!git.available || !git.repoPath}
            >
              {t("git.tabs.changes")}
              {changesCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                  {changesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tools" disabled={!git.available || !git.repoPath}>
              {t("git.tabs.tools")}
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              disabled={!git.available || !git.repoPath}
            >
              {t("git.tabs.advanced")}
            </TabsTrigger>
            <TabsTrigger
              value="operations"
              disabled={!git.available || !git.repoPath}
            >
              {t("git.tabs.operations")}
            </TabsTrigger>
          </TabsList>

          {hiddenPanelsForActiveTab.length > 0 && (
            <Alert data-testid="git-workbench-restore-bar">
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span>{t("git.workbench.restoreHidden")}</span>
                {hiddenPanelsForActiveTab.map((panelId) => (
                  <Button
                    key={panelId}
                    type="button"
                    size="xs"
                    variant="outline"
                    data-testid={`git-workbench-restore-${panelId}`}
                    onClick={() => restoreWorkbenchPanel(panelId)}
                  >
                    {t("git.workbench.restorePanel", {
                      panel: getWorkbenchPanelLabel(panelId),
                    })}
                  </Button>
                ))}
                {hiddenPanelsForActiveTab.length > 1 && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={restoreAllWorkbenchPanels}
                  >
                    {t("git.workbench.restoreAll")}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <TabsContent value="overview" className="space-y-4 mt-4">
            <GitOverviewTab />
          </TabsContent>

          <TabsContent value="repository" className="space-y-4 mt-4">
            <GitRepositoryTab />
          </TabsContent>

          <TabsContent value="graph" className="space-y-4 mt-4">
            <GitGraphTab />
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <GitHistoryTab />
          </TabsContent>

          <TabsContent value="changes" className="space-y-4 mt-4">
            <GitChangesTab />
          </TabsContent>

          <TabsContent value="tools" className="space-y-4 mt-4">
            <GitToolsTab />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <GitAdvancedTab />
          </TabsContent>

          <TabsContent value="operations" className="space-y-4 mt-4">
            <GitOperationsTab />
          </TabsContent>
        </Tabs>
      </GitTabContext.Provider>
    </div>
  );
}

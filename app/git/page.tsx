"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { GitWorkbenchPanel } from "@/components/git/git-workbench-panel";
import { useGit } from "@/hooks/use-git";
import { useGitAdvanced } from "@/hooks/use-git-advanced";
import { useGitLfs } from "@/hooks/use-git-lfs";
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
import {
  GitStatusCard,
  GitConfigCard,
  GitGlobalSettingsCard,
  GitAliasCard,
  GitRepoSelector,
  GitBranchCard,
  GitRemoteCard,
  GitStashList,
  GitTagList,
  GitCommitLog,
  GitContributorsChart,
  GitFileHistory,
  GitBlameView,
  GitEmptyState,
  GitNotAvailable,
  GitRepoInfoCard,
  GitCommitDetail,
  GitStatusFiles,
  GitSearchCommits,
  GitCommitGraph,
  GitVisualFileHistory,
  GitActivityHeatmap,
  GitCommitDialog,
  GitDiffViewer,
  GitCloneDialog,
  GitMergeDialog,
  GitReflogCard,
  GitRepoActionBar,
  GitConflictBanner,
  GitSubmodulesCard,
  GitWorktreesCard,
  GitGitignoreCard,
  GitHooksCard,
  GitLfsCard,
  GitLocalConfigCard,
  GitRepoStatsCard,
  GitSparseCheckoutCard,
  GitRemotePruneCard,
  GitSignatureVerifyCard,
  GitRebaseSquashCard,
  GitInteractiveRebaseCard,
  GitBisectCard,
  GitArchiveCard,
  GitPatchCard,
} from "@/components/git";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, FileText } from "lucide-react";
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
    graphReloadKey,
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
        [panelId]: {
          ...current[panelId],
          collapsed,
        },
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
        [panelId]: {
          ...current[panelId],
          hidden: true,
        },
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
        [panelId]: {
          ...current[panelId],
          hidden: false,
        },
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
        next[panelId] = {
          ...next[panelId],
          hidden: false,
        };
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

  // Restore last repo on mount
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
      if (!feature || feature.supported) {
        return null;
      }

      const parts: string[] = [];
      if (feature.reason?.trim()) {
        parts.push(feature.reason.trim());
      }

      const guidance = feature.nextSteps
        .map((step) => step.trim())
        .filter(Boolean)
        .join(" ");
      if (guidance) {
        parts.push(guidance);
      }

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

  const handleSelectCommitFromGraph = useCallback(
    async (hash: string) => {
      await selectCommitInWorkbench(hash, "graph");
    },
    [selectCommitInWorkbench],
  );

  const handleSelectCommitFromHistory = useCallback(
    async (hash: string) => {
      await selectCommitInWorkbench(hash, "history");
    },
    [selectCommitInWorkbench],
  );

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title={t("git.title")} description={t("git.description")} />
        <GitNotAvailable />
      </div>
    );
  }

  // --- Event Handlers ---

  const handleInstall = async () => {
    try {
      await runAction(() => git.installGit(), {
        successKey: "git.status.installSuccess",
        successDescription: true,
      });
    } catch {
      // Error is already handled by runAction.
    }
  };

  const handleUpdate = async () => {
    try {
      await runAction(() => git.updateGit(), {
        successKey: "git.status.updateSuccess",
        successDescription: true,
      });
    } catch {
      // Error is already handled by runAction.
    }
  };

  const handleSelectRepo = async (path: string) => {
    try {
      await runAction(() => git.setRepoPath(path), {
        onSuccess: async () => {
          repoStore.addRecentRepo(path);
          await refreshAdvancedData();
          await refreshLfsData();
        },
      });
    } catch {
      // Error is already handled by runAction.
    }
  };

  const handleSetConfig = async (key: string, value: string) => {
    try {
      await runAction(() => git.setConfigValue(key, value), {
        successKey: "git.config.saved",
      });
    } catch {
      // Error is already handled by runAction.
    }
  };

  const handleRemoveConfig = async (key: string) => {
    try {
      await runAction(() => git.removeConfigKey(key), {
        successKey: "git.config.removed",
      });
    } catch {
      // Error is already handled by runAction.
    }
  };

  const handleSetAlias = async (name: string, command: string) => {
    try {
      await runAction(() => git.setConfigValue(`alias.${name}`, command), {
        successKey: "git.alias.saved",
      });
    } catch {
      // Error is already handled by runAction.
    }
  };

  const handleRemoveAlias = async (name: string) => {
    try {
      await runAction(() => git.removeConfigKey(`alias.${name}`), {
        successKey: "git.alias.removed",
      });
    } catch {
      // Error is already handled by runAction.
    }
  };

  const handleOpenInEditor = async (): Promise<EditorOpenActionResult> => {
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
  };

  const handleOpenConfigLocation = async (): Promise<void> => {
    if (!configFilePath) return;
    try {
      await revealPath(configFilePath);
      toast.success(t("git.config.openedFallback"));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleApplyConfigPlan = async (
    items: GitConfigApplyPlanItem[],
  ): Promise<GitConfigApplySummary> => {
    return await runAction(() => git.applyConfigPlan(items), {
      onSuccess: async () => {
        await git.refreshConfig();
        const capability = await probeConfigEditor();
        setConfigEditorCapability(capability);
      },
    });
  };

  const handleViewDiff = async (file: string, staged?: boolean) => {
    setDiffLoading(true);
    try {
      ensureWorkbenchPanelVisible("changesInspector");
      const d = await git.getDiff(staged, file);
      setDiffContent(d);
      if (activeTab !== "changes") {
        handleActiveTabChange("changes");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDiffLoading(false);
    }
  };

  const handleShowStashDiff = async (stashId?: string) => {
    try {
      const diff = await runAction(() => git.stashShowDiff(stashId), {
        onSuccess: async (diff) => {
          ensureWorkbenchPanelVisible("changesInspector");
          setDiffContent(diff);
          handleActiveTabChange("changes");
        },
      });
      return diff;
    } catch {
      // Error is already handled by runAction.
      return "";
    }
  };

  const handleAbortOperation = async () => {
    const state = gitAdvanced.mergeRebaseState.state;
    if (state === "merging") return await gitAdvanced.mergeAbort();
    if (state === "rebasing") return await gitAdvanced.rebaseAbort();
    if (state === "cherry_picking") return await gitAdvanced.cherryPickAbort();
    if (state === "reverting") return await gitAdvanced.revertAbort();
    return "";
  };

  const handleContinueOperation = async () => {
    const state = gitAdvanced.mergeRebaseState.state;
    if (state === "merging") return await gitAdvanced.mergeContinue();
    if (state === "rebasing") return await gitAdvanced.rebaseContinue();
    if (state === "cherry_picking")
      return await gitAdvanced.cherryPickContinue();
    return "";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t("git.title")} description={t("git.description")} />

      {git.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{git.error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={handleActiveTabChange}>
        <TabsList>
          <TabsTrigger value="overview">{t("git.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="repository" disabled={!git.available}>
            {t("git.tabs.repository")}
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

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <GitStatusCard
            available={git.available}
            version={git.version}
            executablePath={git.executablePath}
            loading={git.loading}
            onInstall={handleInstall}
            onUpdate={handleUpdate}
            onRefresh={() => git.refreshAll()}
          />
          {git.available && (
            <>
              <GitGlobalSettingsCard
                onGetConfigSnapshot={git.getConfigSnapshot}
                onGetConfigValuesBatch={git.getConfigValuesBatch}
                onGetConfigFilePath={git.getConfigFilePath}
                onOpenConfigLocation={handleOpenConfigLocation}
                onSetConfig={handleSetConfig}
                onSetConfigIfUnset={git.setConfigIfUnset}
                onApplyConfigPlan={handleApplyConfigPlan}
              />
              <GitAliasCard
                onListAliases={git.listAliases}
                onSetAlias={handleSetAlias}
                onRemoveAlias={handleRemoveAlias}
              />
              <GitConfigCard
                config={git.config}
                onSet={handleSetConfig}
                onRemove={handleRemoveConfig}
                configFilePath={configFilePath}
                editorCapability={configEditorCapability}
                onOpenInEditor={handleOpenInEditor}
                onOpenFileLocation={handleOpenConfigLocation}
              />
            </>
          )}
          {git.available === false && <GitEmptyState />}
        </TabsContent>

        {/* Repository Tab */}
        <TabsContent value="repository" className="space-y-4 mt-4">
          <GitRepoSelector
            repoPath={git.repoPath}
            onSelect={handleSelectRepo}
            onInit={git.initRepo}
            loading={git.loading}
          />
          {git.repoInfo ? (
            <>
              <GitConflictBanner
                repoPath={git.repoPath}
                mergeRebaseState={gitAdvanced.mergeRebaseState}
                conflictedFiles={gitAdvanced.conflictedFiles}
                onRefreshState={gitAdvanced.refreshMergeRebaseState}
                onRefreshConflicts={gitAdvanced.refreshConflictedFiles}
                onResolveOurs={async (file) => {
                  const msg = await gitAdvanced.resolveFileOurs(file);
                  await git.refreshStatus();
                  return msg;
                }}
                onResolveTheirs={async (file) => {
                  const msg = await gitAdvanced.resolveFileTheirs(file);
                  await git.refreshStatus();
                  return msg;
                }}
                onMarkResolved={async (file) => {
                  const msg = await gitAdvanced.resolveFileMark(file);
                  await git.refreshStatus();
                  return msg;
                }}
                onAbort={async () => {
                  const msg = await handleAbortOperation();
                  await git.refreshStatus();
                  await gitAdvanced.refreshMergeRebaseState();
                  await gitAdvanced.refreshConflictedFiles();
                  return msg;
                }}
                onContinue={async () => {
                  const msg = await handleContinueOperation();
                  await git.refreshStatus();
                  await gitAdvanced.refreshMergeRebaseState();
                  await gitAdvanced.refreshConflictedFiles();
                  return msg;
                }}
                onSkip={async () => {
                  const msg = await gitAdvanced.rebaseSkip();
                  await git.refreshStatus();
                  await gitAdvanced.refreshMergeRebaseState();
                  await gitAdvanced.refreshConflictedFiles();
                  return msg;
                }}
              />
              <GitRepoInfoCard repoInfo={git.repoInfo} />
              <GitRepoActionBar
                repoPath={git.repoPath}
                currentBranch={git.repoInfo.currentBranch}
                remotes={git.remotes}
                aheadBehind={aheadBehind}
                loading={git.loading}
                onPush={git.push}
                onPull={git.pull}
                onFetch={git.fetch}
                onClean={git.cleanUntracked}
                onCleanPreview={git.cleanDryRun}
                onRefresh={refreshRepoData}
              />
              <GitStatusFiles
                files={git.statusFiles}
                loading={git.loading}
                onRefresh={() => git.refreshStatus()}
                onStage={git.stageFiles}
                onUnstage={git.unstageFiles}
                onStageAll={git.stageAll}
                onDiscard={git.discardChanges}
                onViewDiff={handleViewDiff}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GitBranchCard
                  branches={git.branches}
                  currentBranch={git.repoInfo.currentBranch}
                  aheadBehind={aheadBehind}
                  onCheckout={git.checkoutBranch}
                  onCreate={git.createBranch}
                  onDelete={git.deleteBranch}
                  onDeleteRemote={git.deleteRemoteBranch}
                  onRename={git.branchRename}
                  onSetUpstream={git.branchSetUpstream}
                />
                <GitRemoteCard
                  remotes={git.remotes}
                  onAdd={git.remoteAdd}
                  onRemove={git.remoteRemove}
                  onRename={git.remoteRename}
                  onSetUrl={git.remoteSetUrl}
                  onPrune={gitAdvanced.remotePrune}
                />
                <GitStashList
                  stashes={git.stashes}
                  onApply={git.stashApply}
                  onPop={git.stashPop}
                  onDrop={git.stashDrop}
                  onSave={git.stashSave}
                  onBranchFromStash={gitAdvanced.stashBranch}
                  onPushFiles={git.stashPushFiles}
                  onShowDiff={handleShowStashDiff}
                />
                <GitTagList
                  tags={git.tags}
                  onCreateTag={git.createTag}
                  onDeleteTag={git.deleteTag}
                  onPushTags={git.pushTags}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("git.repo.noRepo")}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GitCloneDialog
              onClone={async (url, destPath, options) => {
                try {
                  const msg = await git.cloneRepo(url, destPath, options);
                  toast.success(t("git.cloneAction.success"), {
                    description: msg,
                  });
                  repoStore.addCloneHistory({
                    url,
                    destPath,
                    timestamp: Date.now(),
                    status: "success",
                  });
                  return msg;
                } catch (e) {
                  repoStore.addCloneHistory({
                    url,
                    destPath,
                    timestamp: Date.now(),
                    status: "failed",
                    errorMessage: String(e),
                  });
                  throw e;
                }
              }}
              onExtractRepoName={git.extractRepoName}
              onValidateUrl={git.validateGitUrl}
              onOpenRepo={(path) => handleSelectRepo(path)}
              onCancelClone={git.cancelClone}
              cloneHistory={repoStore.cloneHistory}
              onClearCloneHistory={repoStore.clearCloneHistory}
            />
            {git.repoInfo && (
              <GitMergeDialog
                branches={git.branches}
                currentBranch={git.repoInfo.currentBranch}
                onMerge={async (branch, noFf) => {
                  try {
                    return await runAction(() => git.merge(branch, noFf), {
                      successKey: "git.mergeAction.success",
                      successDescription: true,
                      onSuccess: refreshAfterGraphWrite,
                    });
                  } catch {
                    // Error is already handled by runAction.
                    return "";
                  }
                }}
              />
            )}
          </div>
        </TabsContent>

        {/* Graph Tab */}
        <TabsContent value="graph" className="space-y-4 mt-4">
          <div
            className={
              workbenchPanels.graphDetail.hidden
                ? "grid grid-cols-1 gap-4"
                : "grid grid-cols-1 gap-4 xl:grid-cols-3"
            }
          >
            <div
              className={workbenchPanels.graphDetail.hidden ? "" : "xl:col-span-2"}
            >
              <GitCommitGraph
                onLoadGraph={git.getGraphLog}
                onSelectCommit={handleSelectCommitFromGraph}
                selectedHash={selectedCommitHash}
                branches={git.branches}
                refreshKey={graphReloadKey}
                onCopyHash={async (hash) => {
                  await writeClipboard(hash);
                  toast.success(t("git.graph.copyHash"));
                }}
                onCreateBranch={async (hash) => {
                  const name = prompt(t("git.graph.createBranch"));
                  if (!name?.trim()) return;
                  try {
                    await runAction(() => git.createBranch(name.trim(), hash), {
                      successKey: "git.branch.createSuccess",
                      successDescription: true,
                      onSuccess: refreshAfterGraphWrite,
                    });
                  } catch {
                    // Error is already handled by runAction.
                  }
                }}
                onCreateTag={async (hash) => {
                  const name = prompt(t("git.graph.createTag"));
                  if (!name?.trim()) return;
                  try {
                    await runAction(() => git.createTag(name.trim(), hash), {
                      successKey: "git.tag.createSuccess",
                      successDescription: true,
                      onSuccess: refreshAfterGraphWrite,
                    });
                  } catch {
                    // Error is already handled by runAction.
                  }
                }}
                onCherryPick={async (hash) => {
                  try {
                    await runAction(() => git.cherryPick(hash), {
                      successKey: "git.cherryPickAction.success",
                      successDescription: true,
                      onSuccess: refreshAfterGraphWrite,
                    });
                  } catch {
                    // Error is already handled by runAction.
                  }
                }}
                onRevert={async (hash) => {
                  try {
                    await runAction(() => git.revertCommit(hash), {
                      successKey: "git.revertAction.success",
                      successDescription: true,
                      onSuccess: refreshAfterGraphWrite,
                    });
                  } catch {
                    // Error is already handled by runAction.
                  }
                }}
                onResetTo={async (hash) => {
                  const confirmed = window.confirm(t("git.resetAction.confirm"));
                  if (!confirmed) return;
                  try {
                    await runAction(() => git.resetHead("mixed", hash, true), {
                      successKey: "git.resetAction.success",
                      successDescription: true,
                      onSuccess: refreshAfterGraphWrite,
                    });
                  } catch {
                    // Error is already handled by runAction.
                  }
                }}
              />
            </div>
            {!workbenchPanels.graphDetail.hidden && (
              <GitWorkbenchPanel
                panelId="graphDetail"
                title={t("git.workbench.panels.graphDetail")}
                description={t("git.workbench.panelDescriptions.graphDetail")}
                state={workbenchPanels.graphDetail}
                onToggleCollapsed={() =>
                  setWorkbenchPanelCollapsed(
                    "graphDetail",
                    !workbenchPanels.graphDetail.collapsed,
                  )
                }
                onHide={() => hideWorkbenchPanel("graphDetail")}
              >
                <div className="space-y-4">
                  <GitCommitDetail
                    hash={selectedCommitHash}
                    detail={commitDetail}
                    loading={detailLoading}
                    onClose={() => {
                      setSelectedCommitHash(null);
                      setCommitDetail(null);
                    }}
                    onGetCommitDiff={git.getCommitDiff}
                  />
                  {!selectedCommitHash && (
                    <GitContributorsChart contributors={git.contributors} />
                  )}
                </div>
              </GitWorkbenchPanel>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div
            className={
              workbenchPanels.historyDetail.hidden
                ? "grid grid-cols-1 gap-4"
                : "grid grid-cols-1 gap-4 xl:grid-cols-3"
            }
          >
            <div
              className={
                workbenchPanels.historyDetail.hidden ? "" : "xl:col-span-2"
              }
            >
              <GitCommitLog
                commits={git.commits}
                onLoadMore={(opts) => git.getLog(opts)}
                onSelectCommit={handleSelectCommitFromHistory}
                selectedHash={selectedCommitHash}
                queryState={git.historyState.log}
              />
            </div>
            {!workbenchPanels.historyDetail.hidden && (
              <GitWorkbenchPanel
                panelId="historyDetail"
                title={t("git.workbench.panels.historyDetail")}
                description={t("git.workbench.panelDescriptions.historyDetail")}
                state={workbenchPanels.historyDetail}
                onToggleCollapsed={() =>
                  setWorkbenchPanelCollapsed(
                    "historyDetail",
                    !workbenchPanels.historyDetail.collapsed,
                  )
                }
                onHide={() => hideWorkbenchPanel("historyDetail")}
              >
                <div className="space-y-4">
                  <GitCommitDetail
                    hash={selectedCommitHash}
                    detail={commitDetail}
                    loading={detailLoading}
                    onClose={() => {
                      setSelectedCommitHash(null);
                      setCommitDetail(null);
                    }}
                    onGetCommitDiff={git.getCommitDiff}
                  />
                  {!selectedCommitHash && (
                    <>
                      <GitContributorsChart contributors={git.contributors} />
                      <GitActivityHeatmap onGetActivity={git.getActivity} />
                    </>
                  )}
                  {selectedCommitHash && (
                    <GitActivityHeatmap onGetActivity={git.getActivity} />
                  )}
                </div>
              </GitWorkbenchPanel>
            )}
          </div>
          <GitSearchCommits
            onSearch={git.searchCommits}
            onSelectCommit={handleSelectCommitFromHistory}
            queryState={git.historyState.search}
          />
          <GitVisualFileHistory
            repoPath={git.repoPath}
            onGetFileStats={git.getFileStats}
            queryState={git.historyState.fileStats}
          />
          <GitFileHistory
            repoPath={git.repoPath}
            onGetHistory={git.getFileHistory}
            onGetCommitDiff={git.getCommitDiff}
            onSelectCommit={handleSelectCommitFromHistory}
            queryState={git.historyState.fileHistory}
          />
          <GitBlameView
            repoPath={git.repoPath}
            onGetBlame={git.getBlame}
            queryState={git.historyState.blame}
          />
          <GitReflogCard
            onGetReflog={git.getReflog}
            onSelectCommit={handleSelectCommitFromHistory}
            queryState={git.historyState.reflog}
            onResetTo={async (hash, mode) => {
              const confirmed = window.confirm(t("git.resetAction.confirm"));
              if (!confirmed) return "";
              try {
                return await runAction(() => git.resetHead(mode, hash, true), {
                  successKey: "git.resetAction.success",
                  successDescription: true,
                  onSuccess: refreshAfterGraphWrite,
                });
              } catch {
                // Error is already handled by runAction.
                return "";
              }
            }}
          />
        </TabsContent>

        {/* Changes Tab */}
        <TabsContent value="changes" className="space-y-4 mt-4">
          <div
            className={
              workbenchPanels.changesInspector.hidden
                ? "grid grid-cols-1 gap-4"
                : "grid grid-cols-1 gap-4 lg:grid-cols-2"
            }
          >
            <GitStatusFiles
              files={git.statusFiles}
              loading={git.loading}
              onRefresh={() => git.refreshStatus()}
              onStage={git.stageFiles}
              onUnstage={git.unstageFiles}
              onStageAll={git.stageAll}
              onDiscard={git.discardChanges}
              onViewDiff={handleViewDiff}
            />
            <GitCommitDialog
              stagedCount={
                git.statusFiles.filter(
                  (f) => f.indexStatus !== " " && f.indexStatus !== "?",
                ).length
              }
              onCommit={async (
                message,
                amend,
                allowEmpty,
                signoff,
                noVerify,
              ) => {
                try {
                  return await runAction(
                    () =>
                      git.commit(message, amend, allowEmpty, signoff, noVerify),
                    {
                      successKey: "git.commit.success",
                      successDescription: true,
                      onSuccess: refreshAfterGraphWrite,
                    },
                  );
                } catch {
                  // Error is already handled by runAction.
                  return "";
                }
              }}
            />
            {!workbenchPanels.changesInspector.hidden && (
              <GitWorkbenchPanel
                panelId="changesInspector"
                title={t("git.workbench.panels.changesInspector")}
                description={t(
                  "git.workbench.panelDescriptions.changesInspector",
                )}
                state={workbenchPanels.changesInspector}
                onToggleCollapsed={() =>
                  setWorkbenchPanelCollapsed(
                    "changesInspector",
                    !workbenchPanels.changesInspector.collapsed,
                  )
                }
                onHide={() => hideWorkbenchPanel("changesInspector")}
                contentClassName="space-y-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setDiffLoading(true);
                      try {
                        const d = await git.getDiff(
                          false,
                          undefined,
                          contextLines,
                        );
                        setDiffContent(d);
                      } finally {
                        setDiffLoading(false);
                      }
                    }}
                    disabled={!git.repoPath}
                  >
                    {t("git.diffView.unstaged")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setDiffLoading(true);
                      try {
                        const d = await git.getDiff(
                          true,
                          undefined,
                          contextLines,
                        );
                        setDiffContent(d);
                      } finally {
                        setDiffLoading(false);
                      }
                    }}
                    disabled={!git.repoPath}
                  >
                    {t("git.diffView.staged")}
                  </Button>
                  <span className="mx-1 h-6 w-px self-center bg-border" />
                  <input
                    type="text"
                    placeholder={t("git.diffView.fromCommit")}
                    value={compareFrom}
                    onChange={(e) => setCompareFrom(e.target.value)}
                    className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs font-mono placeholder:text-muted-foreground"
                  />
                  <span className="self-center text-xs text-muted-foreground">
                    ..
                  </span>
                  <input
                    type="text"
                    placeholder={t("git.diffView.toCommit")}
                    value={compareTo}
                    onChange={(e) => setCompareTo(e.target.value)}
                    className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs font-mono placeholder:text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !git.repoPath ||
                      !compareFrom.trim() ||
                      !compareTo.trim() ||
                      diffLoading
                    }
                    onClick={async () => {
                      setDiffLoading(true);
                      try {
                        const d = await git.getDiffBetween(
                          compareFrom.trim(),
                          compareTo.trim(),
                          undefined,
                          contextLines,
                        );
                        setDiffContent(d);
                      } catch (e) {
                        toast.error(String(e));
                      } finally {
                        setDiffLoading(false);
                      }
                    }}
                  >
                    {t("git.diffView.compare")}
                  </Button>
                  <span className="mx-1 h-6 w-px self-center bg-border" />
                  <Select
                    value={
                      contextLines === undefined ? "default" : String(contextLines)
                    }
                    onValueChange={(v) =>
                      setContextLines(v === "default" ? undefined : Number(v))
                    }
                  >
                    <SelectTrigger className="h-8 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        {t("git.diffView.contextDefault")}
                      </SelectItem>
                      <SelectItem value="5">
                        5 {t("git.diffView.contextLines")}
                      </SelectItem>
                      <SelectItem value="10">
                        10 {t("git.diffView.contextLines")}
                      </SelectItem>
                      <SelectItem value="20">
                        20 {t("git.diffView.contextLines")}
                      </SelectItem>
                      <SelectItem value="50">
                        {t("git.diffView.contextAll")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <GitDiffViewer diff={diffContent} loading={diffLoading} />
              </GitWorkbenchPanel>
            )}
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4 mt-4">
          {!workbenchPanels.toolsWorkspace.hidden && (
            <GitWorkbenchPanel
              panelId="toolsWorkspace"
              title={t("git.workbench.panels.toolsWorkspace")}
              description={t("git.workbench.panelDescriptions.toolsWorkspace")}
              state={workbenchPanels.toolsWorkspace}
              onToggleCollapsed={() =>
                setWorkbenchPanelCollapsed(
                  "toolsWorkspace",
                  !workbenchPanels.toolsWorkspace.collapsed,
                )
              }
              onHide={() => hideWorkbenchPanel("toolsWorkspace")}
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <GitSubmodulesCard
                  submodules={gitAdvanced.submodules}
                  onRefresh={gitAdvanced.refreshSubmodules}
                  onAdd={gitAdvanced.addSubmodule}
                  onUpdate={gitAdvanced.updateSubmodules}
                  onRemove={gitAdvanced.removeSubmodule}
                  onSync={gitAdvanced.syncSubmodules}
                />
                <GitWorktreesCard
                  worktrees={gitAdvanced.worktrees}
                  onRefresh={gitAdvanced.refreshWorktrees}
                  onAdd={gitAdvanced.addWorktree}
                  onRemove={gitAdvanced.removeWorktree}
                  onPrune={gitAdvanced.pruneWorktrees}
                />
                <GitGitignoreCard
                  onGetGitignore={gitAdvanced.getGitignore}
                  onSetGitignore={gitAdvanced.setGitignore}
                  onCheckIgnore={gitAdvanced.checkIgnore}
                  onAddToGitignore={gitAdvanced.addToGitignore}
                />
                <GitHooksCard
                  hooks={gitAdvanced.hooks}
                  onRefresh={gitAdvanced.refreshHooks}
                  onGetContent={gitAdvanced.getHookContent}
                  onSetContent={gitAdvanced.setHookContent}
                  onToggle={gitAdvanced.toggleHook}
                />
                <GitLfsCard
                  lfsAvailable={gitLfs.lfsAvailable}
                  lfsVersion={gitLfs.lfsVersion}
                  trackedPatterns={gitLfs.trackedPatterns}
                  lfsFiles={gitLfs.lfsFiles}
                  onCheckAvailability={gitLfs.checkAvailability}
                  onRefreshTrackedPatterns={gitLfs.refreshTrackedPatterns}
                  onRefreshLfsFiles={gitLfs.refreshLfsFiles}
                  onTrack={gitLfs.track}
                  onUntrack={gitLfs.untrack}
                  onInstall={gitLfs.install}
                />
              </div>
            </GitWorkbenchPanel>
          )}
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          {!workbenchPanels.advancedWorkspace.hidden && (
            <GitWorkbenchPanel
              panelId="advancedWorkspace"
              title={t("git.workbench.panels.advancedWorkspace")}
              description={t("git.workbench.panelDescriptions.advancedWorkspace")}
              state={workbenchPanels.advancedWorkspace}
              onToggleCollapsed={() =>
                setWorkbenchPanelCollapsed(
                  "advancedWorkspace",
                  !workbenchPanels.advancedWorkspace.collapsed,
                )
              }
              onHide={() => hideWorkbenchPanel("advancedWorkspace")}
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <GitLocalConfigCard
                  config={gitAdvanced.localConfig}
                  onRefresh={gitAdvanced.refreshLocalConfig}
                  onSet={gitAdvanced.setLocalConfig}
                  onRemove={gitAdvanced.removeLocalConfig}
                  onGetValue={gitAdvanced.getLocalConfigValue}
                />
                <GitRepoStatsCard
                  repoStats={gitAdvanced.repoStats}
                  onRefresh={gitAdvanced.refreshRepoStats}
                  onFsck={gitAdvanced.fsck}
                  onDescribe={gitAdvanced.describe}
                  onIsShallow={gitAdvanced.isShallow}
                  onDeepen={gitAdvanced.deepen}
                  onUnshallow={gitAdvanced.unshallow}
                />
                <GitSparseCheckoutCard
                  isSparseCheckout={gitAdvanced.isSparseCheckout}
                  sparsePatterns={gitAdvanced.sparsePatterns}
                  supportReason={getSupportReason("sparseCheckout")}
                  onRefresh={gitAdvanced.refreshSparseCheckout}
                  onInit={async (cone) => {
                    ensureFeatureSupported("sparseCheckout");
                    return await gitAdvanced.sparseCheckoutInit(cone);
                  }}
                  onSet={async (patterns) => {
                    ensureFeatureSupported("sparseCheckout");
                    return await gitAdvanced.sparseCheckoutSet(patterns);
                  }}
                  onAdd={async (patterns) => {
                    ensureFeatureSupported("sparseCheckout");
                    return await gitAdvanced.sparseCheckoutAdd(patterns);
                  }}
                  onDisable={async () => {
                    ensureFeatureSupported("sparseCheckout");
                    return await gitAdvanced.sparseCheckoutDisable();
                  }}
                />
                <GitRemotePruneCard
                  remotes={git.remotes}
                  onPrune={gitAdvanced.remotePrune}
                />
                <GitSignatureVerifyCard
                  supportReason={getSupportReason("signatureVerify")}
                  onVerifyCommit={async (hash) => {
                    ensureFeatureSupported("signatureVerify");
                    return await gitAdvanced.verifyCommit(hash);
                  }}
                  onVerifyTag={async (tag) => {
                    ensureFeatureSupported("signatureVerify");
                    return await gitAdvanced.verifyTag(tag);
                  }}
                />
              </div>
            </GitWorkbenchPanel>
          )}
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-4 mt-4">
          {!workbenchPanels.operationsWorkspace.hidden && (
            <GitWorkbenchPanel
              panelId="operationsWorkspace"
              title={t("git.workbench.panels.operationsWorkspace")}
              description={t(
                "git.workbench.panelDescriptions.operationsWorkspace",
              )}
              state={workbenchPanels.operationsWorkspace}
              onToggleCollapsed={() =>
                setWorkbenchPanelCollapsed(
                  "operationsWorkspace",
                  !workbenchPanels.operationsWorkspace.collapsed,
                )
              }
              onHide={() => hideWorkbenchPanel("operationsWorkspace")}
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <GitRebaseSquashCard
                  supportReason={getSupportReason("rebaseSquash")}
                  onRebase={async (onto, confirmRisk) => {
                    ensureFeatureSupported("rebaseSquash");
                    const msg = await gitAdvanced.rebase(onto, confirmRisk);
                    await refreshAfterGraphWrite();
                    await refreshAdvancedData();
                    return msg;
                  }}
                  onSquash={async (count, message, confirmRisk) => {
                    ensureFeatureSupported("rebaseSquash");
                    const msg = await gitAdvanced.squash(
                      count,
                      message,
                      confirmRisk,
                    );
                    await refreshAfterGraphWrite();
                    await refreshAdvancedData();
                    return msg;
                  }}
                />
                <GitInteractiveRebaseCard
                  supportReason={getSupportReason("interactiveRebase")}
                  onPreview={async (base) => {
                    ensureFeatureSupported("interactiveRebase");
                    return await gitAdvanced.getRebaseTodoPreview(base);
                  }}
                  onStart={async (base, todo) => {
                    ensureFeatureSupported("interactiveRebase");
                    return await gitAdvanced.startInteractiveRebase(base, todo);
                  }}
                />
                <GitBisectCard
                  bisectState={gitAdvanced.bisectState}
                  supportReason={getSupportReason("bisect")}
                  onRefreshState={async () => {
                    ensureFeatureSupported("bisect");
                    await gitAdvanced.refreshBisectState();
                  }}
                  onStart={async (badRef, goodRef) => {
                    ensureFeatureSupported("bisect");
                    return await gitAdvanced.bisectStart(badRef, goodRef);
                  }}
                  onGood={async () => {
                    ensureFeatureSupported("bisect");
                    return await gitAdvanced.bisectGood();
                  }}
                  onBad={async () => {
                    ensureFeatureSupported("bisect");
                    return await gitAdvanced.bisectBad();
                  }}
                  onSkip={async () => {
                    ensureFeatureSupported("bisect");
                    return await gitAdvanced.bisectSkip();
                  }}
                  onReset={async () => {
                    ensureFeatureSupported("bisect");
                    return await gitAdvanced.bisectReset();
                  }}
                  onLog={async () => {
                    ensureFeatureSupported("bisect");
                    return await gitAdvanced.bisectLog();
                  }}
                />
                <GitArchiveCard
                  supportReason={getSupportReason("archive")}
                  onArchive={async (format, outputPath, refName, prefix) => {
                    ensureFeatureSupported("archive");
                    return await gitAdvanced.archive(
                      format,
                      outputPath,
                      refName,
                      prefix,
                    );
                  }}
                />
                <GitPatchCard
                  supportReason={getSupportReason("patch")}
                  onFormatPatch={async (range, outputDir) => {
                    ensureFeatureSupported("patch");
                    return await gitAdvanced.formatPatch(range, outputDir);
                  }}
                  onApplyPatch={async (patchPath, checkOnly) => {
                    ensureFeatureSupported("patch");
                    return await gitAdvanced.applyPatch(patchPath, checkOnly);
                  }}
                  onApplyMailbox={async (patchPath) => {
                    ensureFeatureSupported("patch");
                    return await gitAdvanced.applyMailbox(patchPath);
                  }}
                />
              </div>
            </GitWorkbenchPanel>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

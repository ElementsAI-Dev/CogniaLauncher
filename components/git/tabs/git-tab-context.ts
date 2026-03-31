"use client";

import { createContext, useContext } from "react";
import type { UseGitReturn } from "@/hooks/git/use-git";
import type { UseGitAdvancedReturn } from "@/hooks/git/use-git-advanced";
import type { UseGitLfsReturn } from "@/hooks/git/use-git-lfs";
import type {
  GitWorkbenchPanelId,
  GitWorkbenchPanelsState,
  GitWorkbenchTab,
} from "@/lib/stores/git";
import type {
  EditorCapabilityProbeResult,
  GitCommitDetail as GitCommitDetailType,
  GitSupportFeature,
  GitSupportFeatureKey,
} from "@/types/tauri";
import type {
  GitConfigApplyPlanItem,
  GitConfigApplySummary,
} from "@/types/git";
import type { EditorOpenActionResult } from "@/types/tauri";

export interface GitTabContextValue {
  git: UseGitReturn;
  gitAdvanced: UseGitAdvancedReturn;
  gitLfs: UseGitLfsReturn;
  repoStore: {
    addRecentRepo: (path: string) => void;
    addCloneHistory: (entry: {
      url: string;
      destPath: string;
      timestamp: number;
      status: "success" | "failed";
      errorMessage?: string;
    }) => void;
    clearCloneHistory: () => void;
    cloneHistory: Array<{
      url: string;
      destPath: string;
      timestamp: number;
      status: "success" | "failed";
      errorMessage?: string;
    }>;
  };

  // Action runner
  runAction: <T>(
    action: () => Promise<T>,
    options?: {
      successKey?: string;
      successDescription?: boolean;
      onSuccess?: (result: T) => Promise<void> | void;
    },
  ) => Promise<T>;

  // Workbench panel state
  workbenchPanels: GitWorkbenchPanelsState;
  setWorkbenchPanelCollapsed: (
    panelId: GitWorkbenchPanelId,
    collapsed: boolean,
  ) => void;
  hideWorkbenchPanel: (panelId: GitWorkbenchPanelId) => void;
  restoreWorkbenchPanel: (panelId: GitWorkbenchPanelId) => void;
  ensureWorkbenchPanelVisible: (panelId: GitWorkbenchPanelId) => void;

  // Refresh orchestrators
  refreshRepoData: () => void;
  refreshAfterGraphWrite: () => Promise<void>;
  refreshAdvancedData: () => Promise<void>;
  refreshLfsData: () => Promise<void>;

  // Commit detail state
  selectedCommitHash: string | null;
  setSelectedCommitHash: (hash: string | null) => void;
  commitDetail: GitCommitDetailType | null;
  setCommitDetail: (detail: GitCommitDetailType | null) => void;
  detailLoading: boolean;
  selectCommitInWorkbench: (
    hash: string,
    preferredTab: "graph" | "history",
  ) => Promise<void>;

  // Diff state
  diffContent: string;
  setDiffContent: (content: string) => void;
  diffLoading: boolean;
  setDiffLoading: (loading: boolean) => void;
  compareFrom: string;
  setCompareFrom: (value: string) => void;
  compareTo: string;
  setCompareTo: (value: string) => void;
  contextLines: number | undefined;
  setContextLines: (value: number | undefined) => void;

  // Support feature gating
  supportByFeature: Partial<
    Record<GitSupportFeatureKey, GitSupportFeature>
  >;
  getSupportReason: (featureKey: GitSupportFeatureKey) => string | null;
  ensureFeatureSupported: (featureKey: GitSupportFeatureKey) => void;

  // Config state
  configFilePath: string | null;
  configEditorCapability: EditorCapabilityProbeResult | null;
  setConfigEditorCapability: (
    capability: EditorCapabilityProbeResult | null,
  ) => void;

  // Navigation
  activeTab: GitWorkbenchTab;
  handleActiveTabChange: (nextTab: string) => void;

  // Config operations (composed handlers)
  handleSetConfig: (key: string, value: string) => Promise<void>;
  handleRemoveConfig: (key: string) => Promise<void>;
  handleOpenInEditor: () => Promise<EditorOpenActionResult>;
  handleOpenConfigLocation: () => Promise<void>;
  handleApplyConfigPlan: (
    items: GitConfigApplyPlanItem[],
  ) => Promise<GitConfigApplySummary>;
}

export const GitTabContext = createContext<GitTabContextValue | null>(null);

export function useGitTabContext(): GitTabContextValue {
  const ctx = useContext(GitTabContext);
  if (!ctx) {
    throw new Error("useGitTabContext must be used within GitTabContext.Provider");
  }
  return ctx;
}

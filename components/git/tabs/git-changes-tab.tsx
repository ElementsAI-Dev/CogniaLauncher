"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { useGitTabContext } from "./git-tab-context";
import { GitWorkbenchPanel } from "@/components/git/git-workbench-panel";
import {
  GitStatusFiles,
  GitCommitDialog,
  GitDiffViewer,
} from "@/components/git";
import { GitDiffToolbar } from "@/components/git/git-diff-toolbar";
import { toast } from "sonner";

export function GitChangesTab() {
  const { t } = useLocale();
  const {
    git,
    runAction,
    workbenchPanels,
    setWorkbenchPanelCollapsed,
    hideWorkbenchPanel,
    ensureWorkbenchPanelVisible,
    refreshAfterGraphWrite,
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
    activeTab,
    handleActiveTabChange,
  } = useGitTabContext();

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

  return (
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
        onCommit={async (message, amend, allowEmpty, signoff, noVerify) => {
          try {
            return await runAction(
              () => git.commit(message, amend, allowEmpty, signoff, noVerify),
              {
                successKey: "git.commit.success",
                successDescription: true,
                onSuccess: refreshAfterGraphWrite,
              },
            );
          } catch {
            return "";
          }
        }}
      />
      {!workbenchPanels.changesInspector.hidden && (
        <GitWorkbenchPanel
          panelId="changesInspector"
          title={t("git.workbench.panels.changesInspector")}
          description={t("git.workbench.panelDescriptions.changesInspector")}
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
          <GitDiffToolbar
            repoPath={git.repoPath}
            diffLoading={diffLoading}
            compareFrom={compareFrom}
            compareTo={compareTo}
            contextLines={contextLines}
            onCompareFromChange={setCompareFrom}
            onCompareToChange={setCompareTo}
            onContextLinesChange={setContextLines}
            onShowUnstaged={async () => {
              setDiffLoading(true);
              try {
                const d = await git.getDiff(false, undefined, contextLines);
                setDiffContent(d);
              } finally {
                setDiffLoading(false);
              }
            }}
            onShowStaged={async () => {
              setDiffLoading(true);
              try {
                const d = await git.getDiff(true, undefined, contextLines);
                setDiffContent(d);
              } finally {
                setDiffLoading(false);
              }
            }}
            onCompare={async () => {
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
          />
          <GitDiffViewer diff={diffContent} loading={diffLoading} />
        </GitWorkbenchPanel>
      )}
    </div>
  );
}

"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { useGitTabContext } from "./git-tab-context";
import { GitWorkbenchPanel } from "@/components/git/git-workbench-panel";
import { useGitActionDialogs } from "@/components/git/use-git-action-dialogs";
import {
  GitCommitLog,
  GitCommitDetail,
  GitContributorsChart,
  GitActivityHeatmap,
  GitSearchCommits,
  GitVisualFileHistory,
  GitFileHistory,
  GitBlameView,
  GitReflogCard,
} from "@/components/git";

export function GitHistoryTab() {
  const { t } = useLocale();
  const {
    git,
    runAction,
    workbenchPanels,
    setWorkbenchPanelCollapsed,
    hideWorkbenchPanel,
    selectedCommitHash,
    setSelectedCommitHash,
    commitDetail,
    detailLoading,
    setCommitDetail,
    selectCommitInWorkbench,
    refreshAfterGraphWrite,
  } = useGitTabContext();
  const { confirm, dialogs } = useGitActionDialogs();

  const handleSelectCommit = async (hash: string) => {
    await selectCommitInWorkbench(hash, "history");
  };

  return (
    <>
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
            onSelectCommit={handleSelectCommit}
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
        onSelectCommit={handleSelectCommit}
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
        onSelectCommit={handleSelectCommit}
        queryState={git.historyState.fileHistory}
      />
      <GitBlameView
        repoPath={git.repoPath}
        onGetBlame={git.getBlame}
        queryState={git.historyState.blame}
      />
      <GitReflogCard
        onGetReflog={git.getReflog}
        onSelectCommit={handleSelectCommit}
        queryState={git.historyState.reflog}
        onResetTo={async (hash, mode) => {
          const confirmed = await confirm({
            title: t("git.resetAction.title"),
            description: t("git.resetAction.confirm"),
          });
          if (!confirmed) return "";
          try {
            return await runAction(() => git.resetHead(mode, hash, true), {
              successKey: "git.resetAction.success",
              successDescription: true,
              onSuccess: refreshAfterGraphWrite,
            });
          } catch {
            return "";
          }
        }}
      />
      {dialogs}
    </>
  );
}

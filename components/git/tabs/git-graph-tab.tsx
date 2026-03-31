"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { writeClipboard } from "@/lib/clipboard";
import { useGitTabContext } from "./git-tab-context";
import { GitWorkbenchPanel } from "@/components/git/git-workbench-panel";
import { useGitActionDialogs } from "@/components/git/use-git-action-dialogs";
import {
  GitCommitGraph,
  GitCommitDetail,
  GitContributorsChart,
} from "@/components/git";
import { toast } from "sonner";

export function GitGraphTab() {
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
  const { confirm, prompt, dialogs } = useGitActionDialogs();

  const handleSelectCommit = async (hash: string) => {
    await selectCommitInWorkbench(hash, "graph");
  };

  return (
    <>
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
          onSelectCommit={handleSelectCommit}
          selectedHash={selectedCommitHash}
          branches={git.branches}
          refreshKey={git.graphReloadKey}
          onCopyHash={async (hash) => {
            await writeClipboard(hash);
            toast.success(t("git.graph.copyHash"));
          }}
          onCreateBranch={async (hash) => {
            const name = await prompt({
              title: t("git.graph.createBranch"),
              label: t("git.branchAction.newBranchName"),
              placeholder: t("git.branchAction.newBranchName"),
            });
            if (!name?.trim()) return;
            try {
              await runAction(() => git.createBranch(name.trim(), hash), {
                successKey: "git.branch.createSuccess",
                successDescription: true,
                onSuccess: refreshAfterGraphWrite,
              });
            } catch {
              // handled by runAction
            }
          }}
          onCreateTag={async (hash) => {
            const name = await prompt({
              title: t("git.graph.createTag"),
              label: t("git.tagAction.namePlaceholder"),
              placeholder: t("git.tagAction.namePlaceholder"),
            });
            if (!name?.trim()) return;
            try {
              await runAction(() => git.createTag(name.trim(), hash), {
                successKey: "git.tag.createSuccess",
                successDescription: true,
                onSuccess: refreshAfterGraphWrite,
              });
            } catch {
              // handled by runAction
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
              // handled by runAction
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
              // handled by runAction
            }
          }}
          onResetTo={async (hash) => {
            const confirmed = await confirm({
              title: t("git.resetAction.title"),
              description: t("git.resetAction.confirm"),
            });
            if (!confirmed) return;
            try {
              await runAction(() => git.resetHead("mixed", hash, true), {
                successKey: "git.resetAction.success",
                successDescription: true,
                onSuccess: refreshAfterGraphWrite,
              });
            } catch {
              // handled by runAction
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
    {dialogs}
    </>
  );
}

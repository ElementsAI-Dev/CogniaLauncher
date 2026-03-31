"use client";

import { useCallback } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { useGitTabContext } from "./git-tab-context";
import {
  GitRepoSelector,
  GitConflictBanner,
  GitRepoInfoCard,
  GitRepoActionBar,
  GitStatusFiles,
  GitBranchCard,
  GitRemoteCard,
  GitStashList,
  GitTagList,
  GitCloneDialog,
  GitMergeDialog,
} from "@/components/git";
import { FileText } from "lucide-react";
import { toast } from "sonner";

export function GitRepositoryTab() {
  const { t } = useLocale();
  const {
    git,
    gitAdvanced,
    runAction,
    repoStore,
    refreshRepoData,
    refreshAfterGraphWrite,
    refreshAdvancedData,
    refreshLfsData,
    diffContent,
    setDiffContent,
    diffLoading,
    setDiffLoading,
    activeTab,
    handleActiveTabChange,
    ensureWorkbenchPanelVisible,
  } = useGitTabContext();

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
      // handled by runAction
    }
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
      return "";
    }
  };

  const handleAbortOperation = useCallback(async () => {
    const state = gitAdvanced.mergeRebaseState.state;
    if (state === "merging") return await gitAdvanced.mergeAbort();
    if (state === "rebasing") return await gitAdvanced.rebaseAbort();
    if (state === "cherry_picking") return await gitAdvanced.cherryPickAbort();
    if (state === "reverting") return await gitAdvanced.revertAbort();
    return "";
  }, [gitAdvanced]);

  const handleContinueOperation = useCallback(async () => {
    const state = gitAdvanced.mergeRebaseState.state;
    if (state === "merging") return await gitAdvanced.mergeContinue();
    if (state === "rebasing") return await gitAdvanced.rebaseContinue();
    if (state === "cherry_picking")
      return await gitAdvanced.cherryPickContinue();
    return "";
  }, [gitAdvanced]);

  return (
    <>
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
            aheadBehind={git.aheadBehind}
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
              aheadBehind={git.aheadBehind}
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
                return "";
              }
            }}
          />
        )}
      </div>
    </>
  );
}

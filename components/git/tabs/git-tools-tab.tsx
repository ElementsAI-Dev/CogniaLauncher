"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { useGitTabContext } from "./git-tab-context";
import { GitWorkbenchPanel } from "@/components/git/git-workbench-panel";
import {
  GitSubmodulesCard,
  GitWorktreesCard,
  GitGitignoreCard,
  GitHooksCard,
  GitLfsCard,
} from "@/components/git";

export function GitToolsTab() {
  const { t } = useLocale();
  const {
    gitAdvanced,
    gitLfs,
    workbenchPanels,
    setWorkbenchPanelCollapsed,
    hideWorkbenchPanel,
  } = useGitTabContext();

  if (workbenchPanels.toolsWorkspace.hidden) return null;

  return (
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
  );
}

"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { useGitTabContext } from "./git-tab-context";
import { GitWorkbenchPanel } from "@/components/git/git-workbench-panel";
import {
  GitLocalConfigCard,
  GitRepoStatsCard,
  GitSparseCheckoutCard,
  GitRemotePruneCard,
  GitSignatureVerifyCard,
} from "@/components/git";

export function GitAdvancedTab() {
  const { t } = useLocale();
  const {
    git,
    gitAdvanced,
    workbenchPanels,
    setWorkbenchPanelCollapsed,
    hideWorkbenchPanel,
    getSupportReason,
    ensureFeatureSupported,
  } = useGitTabContext();

  if (workbenchPanels.advancedWorkspace.hidden) return null;

  return (
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
  );
}

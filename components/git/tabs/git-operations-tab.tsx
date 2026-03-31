"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { useGitTabContext } from "./git-tab-context";
import { GitWorkbenchPanel } from "@/components/git/git-workbench-panel";
import {
  GitRebaseSquashCard,
  GitInteractiveRebaseCard,
  GitBisectCard,
  GitArchiveCard,
  GitPatchCard,
} from "@/components/git";

export function GitOperationsTab() {
  const { t } = useLocale();
  const {
    gitAdvanced,
    workbenchPanels,
    setWorkbenchPanelCollapsed,
    hideWorkbenchPanel,
    getSupportReason,
    ensureFeatureSupported,
    refreshAfterGraphWrite,
    refreshAdvancedData,
  } = useGitTabContext();

  if (workbenchPanels.operationsWorkspace.hidden) return null;

  return (
    <GitWorkbenchPanel
      panelId="operationsWorkspace"
      title={t("git.workbench.panels.operationsWorkspace")}
      description={t("git.workbench.panelDescriptions.operationsWorkspace")}
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
            const msg = await gitAdvanced.squash(count, message, confirmRisk);
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
  );
}

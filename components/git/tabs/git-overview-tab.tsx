"use client";

import { useGitTabContext } from "./git-tab-context";
import {
  GitStatusCard,
  GitGlobalSettingsCard,
  GitAliasCard,
  GitConfigCard,
  GitEmptyState,
} from "@/components/git";

export function GitOverviewTab() {
  const {
    git,
    runAction,
    configFilePath,
    configEditorCapability,
    handleSetConfig,
    handleRemoveConfig,
    handleOpenInEditor,
    handleOpenConfigLocation,
    handleApplyConfigPlan,
  } = useGitTabContext();

  const handleInstall = async () => {
    try {
      await runAction(() => git.installGit(), {
        successKey: "git.status.installSuccess",
        successDescription: true,
      });
    } catch {
      // handled by runAction
    }
  };

  const handleUpdate = async () => {
    try {
      await runAction(() => git.updateGit(), {
        successKey: "git.status.updateSuccess",
        successDescription: true,
      });
    } catch {
      // handled by runAction
    }
  };

  const handleSetAlias = async (name: string, command: string) => {
    try {
      await runAction(() => git.setConfigValue(`alias.${name}`, command), {
        successKey: "git.alias.saved",
      });
    } catch {
      // handled by runAction
    }
  };

  const handleRemoveAlias = async (name: string) => {
    try {
      await runAction(() => git.removeConfigKey(`alias.${name}`), {
        successKey: "git.alias.removed",
      });
    } catch {
      // handled by runAction
    }
  };

  return (
    <>
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
    </>
  );
}

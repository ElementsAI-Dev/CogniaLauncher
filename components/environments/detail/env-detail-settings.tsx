"use client";

import { useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileCode,
  RefreshCw,
  Variable,
} from "lucide-react";
import {
  useEnvironmentStore,
  type EnvironmentSettings,
} from "@/lib/stores/environment";
import { useEnvironments } from "@/hooks/environments/use-environments";
import { useProjectPath } from "@/hooks/environments/use-auto-version";
import { toast } from "sonner";
import { EnvVarsEditor } from "@/components/environments/shared/env-vars-editor";
import { DetectionFilesList } from "@/components/environments/shared/detection-files-list";
import { AutoSwitchToggle } from "@/components/environments/shared/auto-switch-toggle";

interface EnvDetailSettingsProps {
  envType: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailSettings({ envType, t }: EnvDetailSettingsProps) {
  const { getEnvSettings } = useEnvironmentStore();
  const { loadEnvSettings, saveEnvSettings, detectVersions } = useEnvironments();
  const { projectPath } = useProjectPath();
  const envSettings = getEnvSettings(envType);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      void loadEnvSettings(envType);
    }
  }, [envType, loadEnvSettings]);

  const updateSettings = async (nextSettings: EnvironmentSettings) => {
    try {
      await saveEnvSettings(envType, nextSettings);
      await detectVersions(projectPath || ".");
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleAddEnvVariable = async (variable: { key: string; value: string; enabled: boolean }) => {
    await updateSettings({
      ...envSettings,
      envVariables: [...envSettings.envVariables, variable],
    });
    toast.success(t("environments.details.envVarAdded"));
  };

  const handleRemoveEnvVariable = async (key: string) => {
    await updateSettings({
      ...envSettings,
      envVariables: envSettings.envVariables.filter((v) => v.key !== key),
    });
  };

  const handleToggleEnvVariable = async (key: string, enabled: boolean) => {
    await updateSettings({
      ...envSettings,
      envVariables: envSettings.envVariables.map((v) =>
        v.key === key ? { ...v, enabled } : v,
      ),
    });
  };

  const handleToggleDetectionFile = async (
    fileName: string,
    enabled: boolean,
  ) => {
    await updateSettings({
      ...envSettings,
      detectionFiles: envSettings.detectionFiles.map((file) =>
        file.fileName === fileName ? { ...file, enabled } : file,
      ),
    });
  };

  const handleToggleAutoSwitch = async (enabled: boolean) => {
    await updateSettings({
      ...envSettings,
      autoSwitch: enabled,
    });
  };

  return (
    <div className="space-y-6">
      {/* Auto Switch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t("environments.details.autoSwitch")}
          </CardTitle>
          <CardDescription>
            {t("environments.details.autoSwitchDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutoSwitchToggle
            enabled={envSettings.autoSwitch}
            onToggle={handleToggleAutoSwitch}
            t={t}
          />
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Variable className="h-4 w-4" />
            {t("environments.details.envVariables")}
          </CardTitle>
          <CardDescription>
            {t("environments.details.envVariablesDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnvVarsEditor
            variables={envSettings.envVariables}
            onAdd={handleAddEnvVariable}
            onRemove={handleRemoveEnvVariable}
            onToggle={handleToggleEnvVariable}
            t={t}
          />
        </CardContent>
      </Card>

      {/* Project Detection Files */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            {t("environments.details.projectDetection")}
          </CardTitle>
          <CardDescription>
            {t("environments.details.projectDetectionDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetectionFilesList
            files={envSettings.detectionFiles}
            onToggle={handleToggleDetectionFile}
            t={t}
          />
        </CardContent>
      </Card>
    </div>
  );
}

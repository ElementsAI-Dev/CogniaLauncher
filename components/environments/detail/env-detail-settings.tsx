"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  X,
  FileCode,
  RefreshCw,
  Variable,
} from "lucide-react";
import {
  useEnvironmentStore,
  type EnvironmentSettings,
} from "@/lib/stores/environment";
import { useEnvironments } from "@/hooks/use-environments";
import { toast } from "sonner";

interface EnvDetailSettingsProps {
  envType: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailSettings({ envType, t }: EnvDetailSettingsProps) {
  const { getEnvSettings } = useEnvironmentStore();
  const { loadEnvSettings, saveEnvSettings } = useEnvironments();
  const envSettings = getEnvSettings(envType);

  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
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
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleAddEnvVariable = async () => {
    if (!newVarKey.trim()) return;
    await updateSettings({
      ...envSettings,
      envVariables: [
        ...envSettings.envVariables,
        { key: newVarKey, value: newVarValue, enabled: true },
      ],
    });
    setNewVarKey("");
    setNewVarValue("");
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
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">
                  {t("environments.details.autoSwitch")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("environments.detail.autoSwitchDetail")}
                </p>
              </div>
            </div>
            <Switch
              checked={envSettings.autoSwitch}
              onCheckedChange={handleToggleAutoSwitch}
            />
          </div>
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
        <CardContent className="space-y-3">
          {envSettings.envVariables.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {t("environments.detail.noEnvVars")}
            </div>
          )}

          {envSettings.envVariables.map((envVar) => (
            <div
              key={envVar.key}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Switch
                  checked={envVar.enabled}
                  onCheckedChange={(checked) =>
                    handleToggleEnvVariable(envVar.key, checked)
                  }
                  className="shrink-0"
                />
                <code className="px-2 py-0.5 rounded bg-background font-mono text-xs shrink-0">
                  {envVar.key}
                </code>
                <span className="text-muted-foreground text-sm">=</span>
                <span className="text-sm text-muted-foreground truncate">
                  {envVar.value}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleRemoveEnvVariable(envVar.key)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              placeholder={t("environments.details.varKey")}
              value={newVarKey}
              onChange={(e) => setNewVarKey(e.target.value)}
              className="w-[140px] h-9 font-mono text-xs"
            />
            <Input
              placeholder={t("environments.details.varValue")}
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
              className="flex-1 h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddEnvVariable();
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddEnvVariable}
              disabled={!newVarKey.trim()}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              {t("common.add")}
            </Button>
          </div>
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
          {envSettings.detectionFiles.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {t("environments.detail.noDetectionFiles")}
            </div>
          ) : (
            <div className="space-y-2">
              {envSettings.detectionFiles.map((file) => (
                <div
                  key={file.fileName}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    <code className="font-mono text-sm">{file.fileName}</code>
                  </div>
                  <Switch
                    checked={file.enabled}
                    onCheckedChange={(checked) =>
                      handleToggleDetectionFile(file.fileName, checked)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

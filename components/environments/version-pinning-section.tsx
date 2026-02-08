"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, FolderOpen } from "lucide-react";
import { isTauri } from "@/lib/tauri";
import { toast } from "sonner";

interface InstalledVersion {
  version: string;
  is_current: boolean;
}

interface VersionPinningSectionProps {
  installedVersions: InstalledVersion[];
  currentVersion: string | null;
  onSetGlobal: (version: string) => Promise<void>;
  onSetLocal: (version: string, projectPath: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function VersionPinningSection({
  installedVersions,
  currentVersion,
  onSetGlobal,
  onSetLocal,
  t,
}: VersionPinningSectionProps) {
  const [selectedLocalVersion, setSelectedLocalVersion] = useState("");
  const [localProjectPath, setLocalProjectPath] = useState("");

  const handleSetGlobal = async (version: string) => {
    try {
      await onSetGlobal(version);
      toast.success(
        t("environments.details.globalVersionSet", { version }),
      );
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleSetLocal = async () => {
    if (!localProjectPath || !selectedLocalVersion) return;
    try {
      await onSetLocal(selectedLocalVersion, localProjectPath);
      toast.success(t("environments.details.localVersionSet"));
      setLocalProjectPath("");
      setSelectedLocalVersion("");
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBrowseFolder = async () => {
    if (!isTauri()) {
      toast.info(t("environments.details.manualPathRequired"));
      return;
    }

    try {
      const dialogModule = await import(
        "@tauri-apps/plugin-dialog"
      ).catch(() => null);
      if (dialogModule?.open) {
        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
          title: t("environments.details.selectProjectFolder"),
        });
        if (selected && typeof selected === "string") {
          setLocalProjectPath(selected);
        }
      } else {
        toast.info(t("environments.details.manualPathRequired"));
      }
    } catch {
      toast.info(t("environments.details.manualPathRequired"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Global Version */}
      <div className="p-4 rounded-lg bg-muted/30 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {t("environments.details.globalVersion")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("environments.details.globalVersionDesc")}
            </p>
          </div>
          <Select
            value={currentVersion || ""}
            onValueChange={handleSetGlobal}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue
                placeholder={t("environments.selectVersion")}
              />
            </SelectTrigger>
            <SelectContent>
              {installedVersions.map((v) => (
                <SelectItem key={v.version} value={v.version}>
                  <div className="flex items-center gap-2">
                    {v.is_current && <Check className="h-3 w-3" />}
                    <span className="font-mono">{v.version}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Local Version */}
      <div className="p-4 rounded-lg bg-muted/30 space-y-3">
        <div>
          <p className="text-sm font-medium">
            {t("environments.details.localVersion")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("environments.details.localVersionDesc")}
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedLocalVersion}
            onValueChange={setSelectedLocalVersion}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue
                placeholder={t("environments.selectVersion")}
              />
            </SelectTrigger>
            <SelectContent>
              {installedVersions.map((v) => (
                <SelectItem key={v.version} value={v.version}>
                  <span className="font-mono">{v.version}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1 flex gap-1">
            <Input
              placeholder={t("environments.projectPath")}
              value={localProjectPath}
              onChange={(e) => setLocalProjectPath(e.target.value)}
              className="flex-1 h-9"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleBrowseFolder}
              title={t("environments.details.browseFolder")}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleSetLocal}
            disabled={!localProjectPath || !selectedLocalVersion}
          >
            {t("environments.setLocal")}
          </Button>
        </div>
      </div>
    </div>
  );
}

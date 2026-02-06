"use client";

import { useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen } from "lucide-react";
import { isTauri } from "@/lib/tauri";
import { toast } from "sonner";

interface PathsSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function PathsSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: PathsSettingsProps) {
  const handleBrowse = useCallback(
    async (key: string, title: string) => {
      if (!isTauri()) {
        toast.info(t("settings.pathManualRequired"));
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
            title,
          });
          if (selected && typeof selected === "string") {
            onValueChange(key, selected);
          }
        } else {
          toast.info(t("settings.pathManualRequired"));
        }
      } catch {
        toast.info(t("settings.pathManualRequired"));
      }
    },
    [onValueChange, t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.paths")}</CardTitle>
        <CardDescription>{t("settings.pathsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PathInputItem
          id="paths-root"
          label={t("settings.pathRoot")}
          description={t("settings.pathRootDesc")}
          value={localConfig["paths.root"] || ""}
          onChange={(value) => onValueChange("paths.root", value)}
          onBrowse={() =>
            handleBrowse("paths.root", t("settings.pathRoot"))
          }
          placeholder={t("settings.pathRootPlaceholder")}
          error={errors["paths.root"]}
          t={t}
        />
        <Separator />
        <PathInputItem
          id="paths-cache"
          label={t("settings.pathCache")}
          description={t("settings.pathCacheDesc")}
          value={localConfig["paths.cache"] || ""}
          onChange={(value) => onValueChange("paths.cache", value)}
          onBrowse={() =>
            handleBrowse("paths.cache", t("settings.pathCache"))
          }
          placeholder={t("settings.pathCachePlaceholder")}
          error={errors["paths.cache"]}
          t={t}
        />
        <Separator />
        <PathInputItem
          id="paths-environments"
          label={t("settings.pathEnvironments")}
          description={t("settings.pathEnvironmentsDesc")}
          value={localConfig["paths.environments"] || ""}
          onChange={(value) => onValueChange("paths.environments", value)}
          onBrowse={() =>
            handleBrowse(
              "paths.environments",
              t("settings.pathEnvironments"),
            )
          }
          placeholder={t("settings.pathEnvironmentsPlaceholder")}
          error={errors["paths.environments"]}
          t={t}
        />
      </CardContent>
    </Card>
  );
}

interface PathInputItemProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  onBrowse: () => void;
  placeholder?: string;
  error?: string | null;
  t: (key: string) => string;
}

function PathInputItem({
  id,
  label,
  description,
  value,
  onChange,
  onBrowse,
  placeholder,
  error,
}: PathInputItemProps) {
  return (
    <div className="space-y-2 py-2">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-desc`} className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={`${id}-desc`}
          className={error ? "border-destructive" : ""}
        />
        {isTauri() && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onBrowse}
            aria-label={label}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

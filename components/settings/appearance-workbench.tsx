"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_APPEARANCE_PRESET_ID, type AppearancePreset } from "@/lib/stores/appearance";

interface AppearanceWorkbenchProps {
  presets: AppearancePreset[];
  activePresetId: string;
  hasAppearanceChanges: boolean;
  onSelectPreset: (id: string) => void;
  onApplyPreset: (id: string) => void;
  onSavePreset: (name: string) => void;
  onRenamePreset: (id: string, name: string) => void;
  onDeletePreset: (id: string) => void;
  onResetAppearance: () => void;
  t: (key: string, values?: Record<string, string>) => string;
  children: ReactNode;
}

export function AppearanceWorkbench({
  presets,
  activePresetId,
  hasAppearanceChanges,
  onSelectPreset,
  onApplyPreset,
  onSavePreset,
  onRenamePreset,
  onDeletePreset,
  onResetAppearance,
  t,
  children,
}: AppearanceWorkbenchProps) {
  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) ?? presets[0],
    [activePresetId, presets],
  );
  const [presetNameDraft, setPresetNameDraft] = useState<{
    presetId: string;
    value: string;
  } | null>(null);
  const presetName = presetNameDraft?.presetId === activePresetId
    ? presetNameDraft.value
    : activePreset?.name ?? "";

  const trimmedName = presetName.trim();
  const canRename = Boolean(activePreset && activePreset.id !== DEFAULT_APPEARANCE_PRESET_ID && trimmedName.length > 0);
  const canDelete = Boolean(activePreset && activePreset.id !== DEFAULT_APPEARANCE_PRESET_ID);

  return (
    <Card data-hint="settings-appearance-workbench">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">{t("settings.customizationWorkbenchTitle")}</CardTitle>
            <CardDescription>{t("settings.customizationWorkbenchDesc")}</CardDescription>
          </div>
          {hasAppearanceChanges ? (
            <Badge variant="secondary">{t("settings.customizationWorkbenchChanged")}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{t("settings.customizationPresetSelect")}</p>
            <Select
              value={activePresetId}
              onValueChange={(nextPresetId) => {
                setPresetNameDraft(null);
                onSelectPreset(nextPresetId);
              }}
            >
              <SelectTrigger aria-label={t("settings.customizationPresetSelect")}>
                <SelectValue placeholder={t("settings.customizationPresetSelect")} />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="default"
            onClick={() => onApplyPreset(activePresetId)}
          >
            {t("settings.customizationPresetApply")}
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{t("settings.customizationPresetName")}</p>
            <Input
              value={presetName}
              onChange={(event) =>
                setPresetNameDraft({
                  presetId: activePresetId,
                  value: event.target.value,
                })}
              placeholder={t("settings.customizationPresetNamePlaceholder")}
              aria-label={t("settings.customizationPresetName")}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onSavePreset(trimmedName);
              setPresetNameDraft(null);
            }}
            disabled={trimmedName.length === 0}
          >
            {t("settings.customizationPresetSave")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onRenamePreset(activePresetId, trimmedName);
              setPresetNameDraft(null);
            }}
            disabled={!canRename}
          >
            {t("settings.customizationPresetRename")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onDeletePreset(activePresetId);
              setPresetNameDraft(null);
            }}
            disabled={!canDelete}
          >
            {t("settings.customizationPresetDelete")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" onClick={onResetAppearance}>
            {t("settings.customizationResetAppearance")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("settings.customizationResetAppearanceHint")}
          </p>
        </div>

        <Separator />
        {children}
      </CardContent>
    </Card>
  );
}

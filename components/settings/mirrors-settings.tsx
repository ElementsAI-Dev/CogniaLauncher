"use client";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { SettingItem, SwitchSettingItem } from "./setting-item";
import { MIRROR_PRESETS, type MirrorPresetKey } from "@/lib/constants/mirrors";

interface MirrorsSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function MirrorsSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: MirrorsSettingsProps) {
  const applyPreset = (presetKey: MirrorPresetKey) => {
    const preset = MIRROR_PRESETS[presetKey];
    onValueChange("mirrors.npm", preset.npm);
    onValueChange("mirrors.pypi", preset.pypi);
    onValueChange("mirrors.crates", preset.crates);
    onValueChange("mirrors.go", preset.go);
  };

  const renderAdvancedOptions = (key: string) => {
    const enabledKey = `${key}.enabled`;
    const priorityKey = `${key}.priority`;
    const verifyKey = `${key}.verify_ssl`;

    return (
      <div className="grid gap-4 md:grid-cols-3 py-2">
        <SwitchSettingItem
          id={`${key}-enabled`}
          label={t("settings.mirrorEnabled")}
          description={t("settings.mirrorEnabledDesc")}
          checked={localConfig[enabledKey] !== "false"}
          onCheckedChange={(checked) =>
            onValueChange(enabledKey, checked.toString())
          }
        />
        <SettingItem
          id={`${key}-priority`}
          label={t("settings.mirrorPriority")}
          description={t("settings.mirrorPriorityDesc")}
          value={localConfig[priorityKey] || "0"}
          onChange={(v) => onValueChange(priorityKey, v)}
          type="number"
        />
        <SwitchSettingItem
          id={`${key}-verify`}
          label={t("settings.mirrorVerifySsl")}
          description={t("settings.mirrorVerifySslDesc")}
          checked={localConfig[verifyKey] !== "false"}
          onCheckedChange={(checked) =>
            onValueChange(verifyKey, checked.toString())
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-end mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t("settings.mirrorPresets")}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {t("settings.selectPreset")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(MIRROR_PRESETS).map(([key, preset]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => applyPreset(key as MirrorPresetKey)}
                >
                  {t(preset.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
        <SettingItem
          id="mirrors-npm"
          label={t("settings.npmRegistry")}
          description={t("settings.npmRegistryDesc")}
          value={localConfig["mirrors.npm"] || "https://registry.npmjs.org"}
          onChange={(v) => onValueChange("mirrors.npm", v)}
          placeholder="https://registry.npmjs.org"
          error={errors["mirrors.npm"]}
        />
        {renderAdvancedOptions("mirrors.npm")}
        <Separator />
        <SettingItem
          id="mirrors-pypi"
          label={t("settings.pypiIndex")}
          description={t("settings.pypiIndexDesc")}
          value={localConfig["mirrors.pypi"] || "https://pypi.org/simple"}
          onChange={(v) => onValueChange("mirrors.pypi", v)}
          placeholder="https://pypi.org/simple"
          error={errors["mirrors.pypi"]}
        />
        {renderAdvancedOptions("mirrors.pypi")}
        <Separator />
        <SettingItem
          id="mirrors-crates"
          label={t("settings.cratesRegistry")}
          description={t("settings.cratesRegistryDesc")}
          value={localConfig["mirrors.crates"] || "https://crates.io"}
          onChange={(v) => onValueChange("mirrors.crates", v)}
          placeholder="https://crates.io"
          error={errors["mirrors.crates"]}
        />
        {renderAdvancedOptions("mirrors.crates")}
        <Separator />
        <SettingItem
          id="mirrors-go"
          label={t("settings.goProxy")}
          description={t("settings.goProxyDesc")}
          value={localConfig["mirrors.go"] || "https://proxy.golang.org"}
          onChange={(v) => onValueChange("mirrors.go", v)}
          placeholder="https://proxy.golang.org"
          error={errors["mirrors.go"]}
        />
        {renderAdvancedOptions("mirrors.go")}
    </div>
  );
}

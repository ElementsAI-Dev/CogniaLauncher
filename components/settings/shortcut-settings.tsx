"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { SwitchSettingItem } from "./setting-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { isTauri } from "@/lib/platform";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

const DEFAULT_SHORTCUTS: Record<string, string> = {
  "shortcuts.toggle_window": "CmdOrCtrl+Shift+Space",
  "shortcuts.command_palette": "CmdOrCtrl+Shift+K",
  "shortcuts.quick_search": "CmdOrCtrl+Shift+F",
};

export function getDefaultShortcut(configKey: string): string {
  return DEFAULT_SHORTCUTS[configKey] || "";
}

export function buildShortcutString(e: KeyboardEvent): string | null {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  // Ignore standalone modifier keys
  if (["Control", "Meta", "Shift", "Alt"].includes(e.key)) return null;

  // Map common keys to Tauri format
  const keyMap: Record<string, string> = {
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };
  const key = keyMap[e.key] || e.key.toUpperCase();
  parts.push(key);

  // Require at least one modifier
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) return null;

  return parts.join("+");
}

export function formatDisplayShortcut(shortcut: string): string {
  if (!shortcut) return "—";
  const isMac =
    typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
  return shortcut
    .replace(/CmdOrCtrl/g, isMac ? "⌘" : "Ctrl")
    .replace(/Shift/g, isMac ? "⇧" : "Shift")
    .replace(/Alt/g, isMac ? "⌥" : "Alt")
    .replace(/\+/g, isMac ? "" : "+");
}

interface ShortcutItemProps {
  id: string;
  configKey: string;
  label: string;
  description: string;
  value: string;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

function ShortcutItem({
  id,
  configKey,
  label,
  description,
  value,
  onValueChange,
  t,
}: ShortcutItemProps) {
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const shortcut = buildShortcutString(e);
      if (shortcut) {
        onValueChange(configKey, shortcut);
        setRecording(false);
      }
    },
    [configKey, onValueChange],
  );

  useEffect(() => {
    if (!recording) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, handleKeyDown]);

  // Cancel recording on blur
  useEffect(() => {
    if (!recording) return;
    const handleBlur = () => setRecording(false);
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [recording]);

  const handleReset = useCallback(() => {
    const defaultVal = getDefaultShortcut(configKey);
    onValueChange(configKey, defaultVal);
  }, [configKey, onValueChange]);

  const isDefault = value === getDefaultShortcut(configKey);

  return (
    <div className="flex items-center justify-between py-3">
      <Field className="mr-4 flex-1 gap-1">
        <FieldLabel htmlFor={id} className="font-medium flex items-center gap-2">
          {label}
          {!isDefault && (
            <Badge variant="secondary" className="text-xs">
              {t("settings.section.modified")}
            </Badge>
          )}
        </FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </Field>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          id={id}
          readOnly
          value={recording ? t("settings.shortcutsRecording") : formatDisplayShortcut(value)}
          className={cn(
            "w-48 text-center cursor-pointer font-mono text-sm",
            recording && "ring-2 ring-primary border-primary",
          )}
          onClick={() => setRecording(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setRecording(false);
            }
          }}
        />
        {!isDefault && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={handleReset}
            title={t("settings.shortcutsReset")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ShortcutSettings({
  localConfig,
  onValueChange,
  t,
}: ShortcutSettingsProps) {
  if (!isTauri()) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {t("settings.shortcutsDesktopOnly")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <SwitchSettingItem
        id="shortcuts-enabled"
        label={t("settings.shortcutsEnabled")}
        description={t("settings.shortcutsEnabledDesc")}
        checked={localConfig["shortcuts.enabled"] !== "false"}
        onCheckedChange={(checked) =>
          onValueChange("shortcuts.enabled", checked.toString())
        }
      />
      <Separator />
      <ShortcutItem
        id="shortcuts-toggle-window"
        configKey="shortcuts.toggle_window"
        label={t("settings.shortcutsToggleWindow")}
        description={t("settings.shortcutsToggleWindowDesc")}
        value={localConfig["shortcuts.toggle_window"] || ""}
        onValueChange={onValueChange}
        t={t}
      />
      <Separator />
      <ShortcutItem
        id="shortcuts-command-palette"
        configKey="shortcuts.command_palette"
        label={t("settings.shortcutsCommandPalette")}
        description={t("settings.shortcutsCommandPaletteDesc")}
        value={localConfig["shortcuts.command_palette"] || ""}
        onValueChange={onValueChange}
        t={t}
      />
      <Separator />
      <ShortcutItem
        id="shortcuts-quick-search"
        configKey="shortcuts.quick_search"
        label={t("settings.shortcutsQuickSearch")}
        description={t("settings.shortcutsQuickSearchDesc")}
        value={localConfig["shortcuts.quick_search"] || ""}
        onValueChange={onValueChange}
        t={t}
      />
    </div>
  );
}

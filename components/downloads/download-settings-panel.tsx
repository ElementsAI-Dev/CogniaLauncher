"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import type { SpeedUnit } from "./download-settings-card";

interface DownloadSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speedLimitInput: string;
  onSpeedLimitChange: (value: string) => void;
  speedUnit: SpeedUnit;
  onSpeedUnitChange: (unit: SpeedUnit) => void;
  maxConcurrentInput: string;
  onMaxConcurrentChange: (value: string) => void;
  onApply: () => void;
  disabled: boolean;
  clipboardMonitor?: boolean;
  onClipboardMonitorChange?: (enabled: boolean) => void;
  t: (key: string) => string;
}

export function DownloadSettingsPanel({
  open,
  onOpenChange,
  speedLimitInput,
  onSpeedLimitChange,
  speedUnit,
  onSpeedUnitChange,
  maxConcurrentInput,
  onMaxConcurrentChange,
  onApply,
  disabled,
  clipboardMonitor,
  onClipboardMonitorChange,
  t,
}: DownloadSettingsPanelProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {/* Speed Limit */}
            <div className="space-y-1.5">
              <Label htmlFor="settings-speed-limit" className="text-xs">
                {t("downloads.settings.speedLimit")}
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="settings-speed-limit"
                  type="number"
                  min={0}
                  step="0.1"
                  value={speedLimitInput}
                  onChange={(e) => onSpeedLimitChange(e.target.value)}
                  className="h-8 flex-1"
                  disabled={disabled}
                />
                <Select
                  value={speedUnit}
                  onValueChange={(v) => onSpeedUnitChange(v as SpeedUnit)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B/s">B/s</SelectItem>
                    <SelectItem value="KB/s">KB/s</SelectItem>
                    <SelectItem value="MB/s">MB/s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Max Concurrent */}
            <div className="space-y-1.5">
              <Label htmlFor="settings-max-concurrent" className="text-xs">
                {t("downloads.settings.maxConcurrent")}
              </Label>
              <Input
                id="settings-max-concurrent"
                type="number"
                min={1}
                value={maxConcurrentInput}
                onChange={(e) => onMaxConcurrentChange(e.target.value)}
                className="h-8"
                disabled={disabled}
              />
            </div>

            {/* Clipboard Monitor */}
            {onClipboardMonitorChange !== undefined && (
              <div className="flex items-center gap-2 self-end pb-0.5">
                <Switch
                  id="settings-clipboard"
                  checked={clipboardMonitor ?? false}
                  onCheckedChange={onClipboardMonitorChange}
                  disabled={disabled}
                />
                <Label htmlFor="settings-clipboard" className="text-xs cursor-pointer">
                  {t("downloads.settings.clipboardMonitor")}
                </Label>
              </div>
            )}

            {/* Apply */}
            <div className="self-end">
              <Button size="sm" className="h-8" onClick={onApply} disabled={disabled}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

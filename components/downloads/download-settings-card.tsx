"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SpeedUnit = "B/s" | "KB/s" | "MB/s";

interface DownloadSettingsCardProps {
  speedLimitInput: string;
  onSpeedLimitChange: (value: string) => void;
  speedUnit: SpeedUnit;
  onSpeedUnitChange: (unit: SpeedUnit) => void;
  maxConcurrentInput: string;
  onMaxConcurrentChange: (value: string) => void;
  onApply: () => void;
  disabled: boolean;
  t: (key: string) => string;
}

export function DownloadSettingsCard({
  speedLimitInput,
  onSpeedLimitChange,
  speedUnit,
  onSpeedUnitChange,
  maxConcurrentInput,
  onMaxConcurrentChange,
  onApply,
  disabled,
  t,
}: DownloadSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("downloads.settings.speedLimit")}</CardTitle>
        <CardDescription>
          {t("downloads.settings.speedLimitDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="speed-limit">
              {t("downloads.settings.speedLimit")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="speed-limit"
                type="number"
                min={0}
                step="0.1"
                value={speedLimitInput}
                onChange={(event) => onSpeedLimitChange(event.target.value)}
                className="flex-1"
              />
              <Select
                value={speedUnit}
                onValueChange={(v) => onSpeedUnitChange(v as SpeedUnit)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B/s">B/s</SelectItem>
                  <SelectItem value="KB/s">KB/s</SelectItem>
                  <SelectItem value="MB/s">MB/s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {speedLimitInput === "0"
                ? t("downloads.settings.unlimited")
                : `${speedLimitInput} ${speedUnit}`}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-concurrent">
              {t("downloads.settings.maxConcurrent")}
            </Label>
            <Input
              id="max-concurrent"
              type="number"
              min={1}
              value={maxConcurrentInput}
              onChange={(event) => onMaxConcurrentChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("downloads.settings.maxConcurrentDesc")}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onApply} disabled={disabled}>
          {t("common.save")}
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";

interface AutoSwitchToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function AutoSwitchToggle({
  enabled,
  onToggle,
  t,
}: AutoSwitchToggleProps) {
  return (
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
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

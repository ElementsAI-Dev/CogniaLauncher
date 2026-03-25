"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface ProviderToggleProps {
  providerId: string;
  enabled: boolean;
  isToggling: boolean;
  onToggle: (providerId: string, enabled: boolean) => void;
  idSuffix?: string;
}

export function ProviderToggle({
  providerId,
  enabled,
  isToggling,
  onToggle,
  idSuffix,
}: ProviderToggleProps) {
  const { t } = useLocale();
  const switchId = `enabled-${idSuffix ?? providerId}`;

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={switchId} className="text-sm font-medium">
        {t("providers.enabled")}
      </Label>
      {isToggling && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      )}
      <Switch
        id={switchId}
        checked={enabled}
        onCheckedChange={(checked) => onToggle(providerId, checked)}
        disabled={isToggling}
      />
    </div>
  );
}

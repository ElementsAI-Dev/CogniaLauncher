"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  KeyRound,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Save,
  Trash2,
} from "lucide-react";

interface AuthSectionProps {
  token: string;
  onTokenChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  saveDisabled: boolean;
  clearDisabled: boolean;
  saveLabel: string;
  clearLabel: string;
  hint: string;
  configured: boolean;
  instanceUrl?: string;
  onInstanceUrlChange?: (value: string) => void;
  onSaveInstanceUrl?: () => void;
  instanceUrlLabel?: string;
  instanceUrlSaveLabel?: string;
  instanceUrlSaveDisabled?: boolean;
  t: (key: string) => string;
}

export function AuthSection({
  token,
  onTokenChange,
  onSave,
  onClear,
  saveDisabled,
  clearDisabled,
  saveLabel,
  clearLabel,
  hint,
  configured,
  instanceUrl,
  onInstanceUrlChange,
  onSaveInstanceUrl,
  instanceUrlLabel,
  instanceUrlSaveLabel,
  instanceUrlSaveDisabled,
  t,
}: AuthSectionProps) {
  const [open, setOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border rounded-md"
    >
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
        <KeyRound className="h-4 w-4" />
        {t("downloads.auth.title")}
        {configured && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {t("downloads.auth.configured")}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-3">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="space-y-2">
            <Label className="text-xs">{t("downloads.auth.token")}</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => onTokenChange(e.target.value)}
                  placeholder={t("downloads.auth.tokenPlaceholder")}
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={saveDisabled}
              >
                <Save className="h-3 w-3 mr-1" />
                {saveLabel}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={clearDisabled}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {clearLabel}
              </Button>
            </div>
          </div>
          {onInstanceUrlChange && onSaveInstanceUrl && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {instanceUrlLabel}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={instanceUrl ?? ""}
                  onChange={(e) => onInstanceUrlChange(e.target.value)}
                  placeholder={t("downloads.auth.instanceUrlPlaceholder")}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSaveInstanceUrl}
                  disabled={instanceUrlSaveDisabled}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {instanceUrlSaveLabel}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

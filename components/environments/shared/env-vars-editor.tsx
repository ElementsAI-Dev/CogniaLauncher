"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";
import type { EnvVariable } from "@/lib/stores/environment";

interface EnvVarsEditorProps {
  variables: EnvVariable[];
  onAdd: (variable: EnvVariable) => void;
  onRemove: (key: string) => void;
  onToggle: (key: string, enabled: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarsEditor({
  variables,
  onAdd,
  onRemove,
  onToggle,
  t,
}: EnvVarsEditorProps) {
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");

  const handleAdd = () => {
    if (!newVarKey.trim()) return;
    onAdd({ key: newVarKey, value: newVarValue, enabled: true });
    setNewVarKey("");
    setNewVarValue("");
  };

  return (
    <div className="space-y-3">
      {variables.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          {t("environments.detail.noEnvVars")}
        </div>
      )}

      {variables.map((envVar) => (
        <div
          key={envVar.key}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Switch
              checked={envVar.enabled}
              onCheckedChange={(checked) => onToggle(envVar.key, checked)}
              className="shrink-0"
            />
            <code className="px-2 py-0.5 rounded bg-background font-mono text-xs shrink-0">
              {envVar.key}
            </code>
            <span className="text-muted-foreground text-sm">=</span>
            <span className="text-sm text-muted-foreground truncate">
              {envVar.value}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onRemove(envVar.key)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <div className="flex gap-2">
        <Input
          placeholder={t("environments.details.varKey")}
          value={newVarKey}
          onChange={(e) => setNewVarKey(e.target.value)}
          className="w-[140px] h-9 font-mono text-xs"
        />
        <Input
          placeholder={t("environments.details.varValue")}
          value={newVarValue}
          onChange={(e) => setNewVarValue(e.target.value)}
          className="flex-1 h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newVarKey.trim()}
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          {t("common.add")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { Copy, Eye, Loader2, Pencil, Plus, Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { writeClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type SensitivePattern = string | RegExp;

export interface EnvVarKvItem {
  key: string;
  value: string;
  enabled?: boolean;
  masked?: boolean;
}

interface EnvVarKvEditorLabels {
  empty: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  add: string;
  copy: string;
  copyError: string;
  edit: string;
  delete: string;
  reveal: string;
  enabled: string;
}

interface EnvVarKvEditorProps {
  items: EnvVarKvItem[];
  readOnly?: boolean;
  revealable?: boolean;
  showCopy?: boolean;
  sensitiveKeys?: SensitivePattern[];
  onAdd?: (item: { key: string; value: string }) => void;
  onEdit?: (key: string, value: string) => void;
  onDelete?: (key: string) => void;
  onToggleEnabled?: (key: string, enabled: boolean) => void;
  onReveal?: (key: string) => Promise<string | null>;
  labels?: Partial<EnvVarKvEditorLabels>;
}

const DEFAULT_LABELS: EnvVarKvEditorLabels = {
  empty: "No environment variables",
  keyPlaceholder: "Key",
  valuePlaceholder: "Value",
  add: "Add",
  copy: "Copy",
  copyError: "Failed to copy",
  edit: "Edit",
  delete: "Delete",
  reveal: "Reveal",
  enabled: "Enabled",
};

function matchesSensitiveKey(key: string, patterns: SensitivePattern[]): boolean {
  return patterns.some((pattern) =>
    typeof pattern === "string" ? pattern.toLowerCase() === key.toLowerCase() : pattern.test(key),
  );
}

export function EnvVarKvEditor({
  items,
  readOnly = false,
  revealable = false,
  showCopy = true,
  sensitiveKeys = [],
  onAdd,
  onEdit,
  onDelete,
  onToggleEnabled,
  onReveal,
  labels: labelOverrides,
}: EnvVarKvEditorProps) {
  const labels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labelOverrides }),
    [labelOverrides],
  );
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [revealingKeys, setRevealingKeys] = useState<Record<string, boolean>>({});

  const isSensitive = useCallback(
    (item: EnvVarKvItem) => item.masked || matchesSensitiveKey(item.key, sensitiveKeys),
    [sensitiveKeys],
  );

  const getDisplayValue = useCallback(
    (item: EnvVarKvItem) => {
      if (revealedValues[item.key] != null) {
        return revealedValues[item.key];
      }
      return isSensitive(item) ? "••••••" : item.value;
    },
    [isSensitive, revealedValues],
  );

  const handleAdd = useCallback(() => {
    const key = newKey.trim();
    if (!key || !onAdd) return;
    onAdd({ key, value: newValue });
    setNewKey("");
    setNewValue("");
  }, [newKey, newValue, onAdd]);

  const handleCopy = useCallback(
    async (item: EnvVarKvItem) => {
      try {
        let value = revealedValues[item.key] ?? item.value;
        if (isSensitive(item) && value === item.value && onReveal) {
          const nextValue = await onReveal(item.key);
          if (nextValue != null) {
            value = nextValue;
            setRevealedValues((current) => ({ ...current, [item.key]: nextValue }));
          }
        }
        await writeClipboard(value);
        toast.success(labels.copy);
      } catch {
        toast.error(labels.copyError);
      }
    },
    [isSensitive, labels.copy, labels.copyError, onReveal, revealedValues],
  );

  const handleReveal = useCallback(
    async (item: EnvVarKvItem) => {
      if (!isSensitive(item) || revealedValues[item.key] != null || !onReveal) {
        return;
      }

      setRevealingKeys((current) => ({ ...current, [item.key]: true }));
      try {
        const nextValue = await onReveal(item.key);
        if (nextValue != null) {
          setRevealedValues((current) => ({ ...current, [item.key]: nextValue }));
        }
      } finally {
        setRevealingKeys((current) => {
          const next = { ...current };
          delete next[item.key];
          return next;
        });
      }
    },
    [isSensitive, onReveal, revealedValues],
  );

  const beginEdit = useCallback(
    (item: EnvVarKvItem) => {
      setEditingKey(item.key);
      setEditingValue(revealedValues[item.key] ?? item.value);
    },
    [revealedValues],
  );

  const commitEdit = useCallback(() => {
    if (!editingKey || !onEdit) return;
    onEdit(editingKey, editingValue);
    setEditingKey(null);
    setEditingValue("");
  }, [editingKey, editingValue, onEdit]);

  const cancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditingValue("");
  }, []);

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {labels.empty}
        </div>
      )}

      {items.map((item) => {
        const displayValue = getDisplayValue(item);
        const masked = isSensitive(item) && revealedValues[item.key] == null;
        const isRevealing = Boolean(revealingKeys[item.key]);
        const isEditing = editingKey === item.key;

        return (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {typeof item.enabled === "boolean" && (
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(checked) => onToggleEnabled?.(item.key, checked)}
                  disabled={readOnly || !onToggleEnabled}
                  aria-label={`${labels.enabled} ${item.key}`}
                  className="shrink-0"
                />
              )}
              <code className="shrink-0 rounded bg-background px-2 py-0.5 font-mono text-xs">
                {item.key}
              </code>
              <span className="text-sm text-muted-foreground">=</span>
              {isEditing ? (
                <Input
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitEdit();
                    }
                    if (event.key === "Escape") {
                      cancelEdit();
                    }
                  }}
                  className="h-8 flex-1 font-mono text-xs"
                  autoFocus
                />
              ) : (
                <span className="truncate font-mono text-sm text-muted-foreground">
                  {displayValue || <span className="italic opacity-60">(empty)</span>}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {revealable && masked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => void handleReveal(item)}
                  disabled={isRevealing || !onReveal}
                  aria-label={labels.reveal}
                >
                  {isRevealing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              {showCopy && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => void handleCopy(item)}
                  aria-label={labels.copy}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
              {!readOnly && onEdit && (
                isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={commitEdit}
                      aria-label={labels.add}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={cancelEdit}
                      aria-label="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => beginEdit(item)}
                    aria-label={labels.edit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )
              )}
              {!readOnly && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onDelete(item.key)}
                  aria-label={labels.delete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {!readOnly && onAdd && (
        <div className="flex gap-2">
          <Input
            placeholder={labels.keyPlaceholder}
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            className="h-9 w-[140px] font-mono text-xs"
          />
          <Input
            placeholder={labels.valuePlaceholder}
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            className="h-9 flex-1"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleAdd();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleAdd}
            disabled={!newKey.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            {labels.add}
          </Button>
        </div>
      )}
    </div>
  );
}

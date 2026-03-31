"use client";

import type { EnvVariable } from "@/lib/stores/environment";
import { EnvVarKvEditor } from "@/components/envvar/shared/env-var-kv-editor";

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
  return (
    <EnvVarKvEditor
      items={variables}
      onAdd={({ key, value }) => onAdd({ key, value, enabled: true })}
      onDelete={onRemove}
      onToggleEnabled={onToggle}
      showCopy={false}
      labels={{
        empty: t("environments.detail.noEnvVars"),
        keyPlaceholder: t("environments.details.varKey"),
        valuePlaceholder: t("environments.details.varValue"),
        add: t("common.add"),
        edit: t("envvar.actions.edit"),
        delete: t("envvar.actions.delete"),
        reveal: t("envvar.table.reveal"),
        enabled: t("common.enabled"),
      }}
    />
  );
}

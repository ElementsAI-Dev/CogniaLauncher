import { useCallback, useMemo } from 'react';
import {
  useToolboxStore,
  type ToolPreferenceRecord,
  type ToolPreferenceShape,
} from '@/lib/stores/toolbox';

function mergePreferences<T extends ToolPreferenceRecord>(
  defaults: T,
  raw: ToolPreferenceRecord | undefined,
): ToolPreferenceShape<T> {
  if (!raw) return { ...defaults } as ToolPreferenceShape<T>;
  const merged: ToolPreferenceRecord = { ...defaults };
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in defaults)) continue;
    const defaultValue = defaults[key];
    if (value === null || typeof defaultValue === typeof value) {
      merged[key] = value;
    }
  }
  return merged as ToolPreferenceShape<T>;
}

export function useToolPreferences<T extends ToolPreferenceRecord>(toolId: string, defaults: T) {
  const rawPreferences = useToolboxStore((state) => state.toolPreferences[toolId]);
  const setToolPreferences = useToolboxStore((state) => state.setToolPreferences);

  const preferences = useMemo(
    () => mergePreferences(defaults, rawPreferences),
    [defaults, rawPreferences],
  );

  const setPreferences = useCallback(
    (patch: Partial<ToolPreferenceShape<T>>) => {
      setToolPreferences(toolId, patch as ToolPreferenceRecord);
    },
    [setToolPreferences, toolId],
  );

  return { preferences, setPreferences };
}

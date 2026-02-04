'use client';

import { useEffect, useRef } from 'react';

const UNSAVED_EVENT = 'cognia:check-unsaved';

interface UnsavedChangesRegistry {
  sources: Map<string, boolean>;
}

const registry: UnsavedChangesRegistry = {
  sources: new Map(),
};

function handleCheckUnsaved(event: Event) {
  const customEvent = event as CustomEvent<{ hasChanges: boolean }>;
  let hasAnyChanges = false;
  
  registry.sources.forEach((hasChanges) => {
    if (hasChanges) {
      hasAnyChanges = true;
    }
  });
  
  customEvent.detail.hasChanges = hasAnyChanges;
}

if (typeof window !== 'undefined') {
  window.removeEventListener(UNSAVED_EVENT, handleCheckUnsaved);
  window.addEventListener(UNSAVED_EVENT, handleCheckUnsaved);
}

/**
 * Hook for registering a component's unsaved changes state with the global registry.
 * This allows the titlebar close confirmation to detect unsaved changes across all components.
 * 
 * @param sourceId - Unique identifier for this source of unsaved changes
 * @param hasChanges - Whether this source currently has unsaved changes
 * 
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const [hasChanges, setHasChanges] = useState(false);
 *   useUnsavedChanges('settings-page', hasChanges);
 *   // ...
 * }
 * ```
 */
export function useUnsavedChanges(sourceId: string, hasChanges: boolean): void {
  const sourceIdRef = useRef(sourceId);
  
  useEffect(() => {
    sourceIdRef.current = sourceId;
  }, [sourceId]);

  useEffect(() => {
    registry.sources.set(sourceIdRef.current, hasChanges);
    
    return () => {
      registry.sources.delete(sourceIdRef.current);
    };
  }, [hasChanges]);
}

/**
 * Manually check if there are any unsaved changes across all registered sources.
 * This is useful for programmatic checks outside of the close event.
 */
export function hasGlobalUnsavedChanges(): boolean {
  let hasAnyChanges = false;
  registry.sources.forEach((hasChanges) => {
    if (hasChanges) {
      hasAnyChanges = true;
    }
  });
  return hasAnyChanges;
}

/**
 * Get a list of all sources that currently have unsaved changes.
 */
export function getUnsavedChangesSources(): string[] {
  const sources: string[] = [];
  registry.sources.forEach((hasChanges, sourceId) => {
    if (hasChanges) {
      sources.push(sourceId);
    }
  });
  return sources;
}

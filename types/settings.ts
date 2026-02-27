/**
 * Settings-related type definitions
 * Shared across components, hooks, and lib modules
 */

/** Generic translate function used throughout settings UI */
export type TranslateFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** Validation rule for a settings field */
export interface ValidationRule {
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
}

/** Validation status for path inputs */
export type ValidationStatus = "idle" | "validating" | "valid" | "warning" | "error";

/** Save progress tracking for batch config updates */
export interface SaveProgress {
  current: number;
  total: number;
}

/** Mirror preset configuration */
export interface MirrorPreset {
  labelKey: string;
  npm: string;
  pypi: string;
  crates: string;
  go: string;
}

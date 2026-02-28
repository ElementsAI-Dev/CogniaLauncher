/**
 * Shared types for environment components.
 * These types are used across multiple components in components/environments/.
 */


// ============================================================================
// Batch Operations Types
// ============================================================================

/** A selected version for batch operations */
export interface SelectedVersion {
  envType: string;
  version: string;
}

/** Type of batch operation */
export type OperationType = 'install' | 'uninstall';

/** Result of a batch operation */
export interface OperationResult {
  successful: SelectedVersion[];
  failed: { version: SelectedVersion; error: string }[];
}

// ============================================================================
// Update Check Types (component-level)
// ============================================================================

/** Summary of update information for a single environment */
export interface EnvUpdateInfo {
  envType: string;
  currentVersion: string;
  latestVersion: string;
  latestStable: string | null;
  availableCount: number;
}

// ============================================================================
// Add Environment Dialog Types
// ============================================================================

/** Options for adding a new environment */
export interface AddEnvironmentOptions {
  autoSwitch: boolean;
  setAsDefault: boolean;
}

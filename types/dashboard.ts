/**
 * Dashboard-specific types for CogniaLauncher
 * Extracted from components/dashboard/ for better code organization
 */

// ============================================================================
// Quick Search Types
// ============================================================================

export interface SearchResult {
  type: "environment" | "package" | "action";
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
}

// ============================================================================
// Quick Actions Types
// ============================================================================

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
  variant?: "default" | "secondary" | "outline";
  shortcut?: string;
}

// ============================================================================
// Environment List Types
// ============================================================================

export type EnvironmentFilterType = "all" | "available" | "unavailable";

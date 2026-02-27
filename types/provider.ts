/**
 * Provider management shared types
 */

// --- Toolbar filter/sort types (used by page + toolbar + stores) ---

export type CategoryFilter = "all" | "environment" | "package" | "system";
export type StatusFilter =
  | "all"
  | "available"
  | "unavailable"
  | "enabled"
  | "disabled";
export type SortOption =
  | "name-asc"
  | "name-desc"
  | "priority-asc"
  | "priority-desc"
  | "status";
export type ViewMode = "grid" | "list";
export type PlatformFilter = "all" | "windows" | "linux" | "macos";

// --- Icon component prop types ---

export interface IconProps {
  size?: number;
  className?: string;
}

export interface ProviderIconProps extends IconProps {
  providerId: string;
}

export interface PlatformIconProps extends IconProps {
  platform: string;
}

export interface LanguageIconProps extends IconProps {
  languageId: string;
}

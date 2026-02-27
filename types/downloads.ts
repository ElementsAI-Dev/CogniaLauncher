/**
 * Shared types for the Downloads module components
 */

export type StatusFilter =
  | "all"
  | "downloading"
  | "queued"
  | "paused"
  | "completed"
  | "failed";

export interface ArchiveFormat {
  value: string;
  label: string;
}

export interface RefItemBadge {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
}

export interface RefItem {
  name: string;
  badges?: RefItemBadge[];
}

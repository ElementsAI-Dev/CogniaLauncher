/**
 * Toolbox Types for CogniaLauncher
 * Plugin-style developer tool system with registry pattern
 */

// ============================================================================
// Tool Categories
// ============================================================================

/** Tool category identifiers (inspired by DevToys PredefinedCommonToolGroupNames) */
export type ToolCategory =
  | 'converters'
  | 'encoders'
  | 'formatters'
  | 'generators'
  | 'text'
  | 'network'
  | 'graphics'
  | 'developer'
  | 'system';

/** Category metadata for navigation display */
export interface ToolCategoryMeta {
  id: ToolCategory;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  color: string;
}

/** Virtual category for navigation (includes special groups) */
export type ToolCategoryFilter = ToolCategory | 'all' | 'favorites' | 'recent';

// ============================================================================
// Tool Definition
// ============================================================================

/** Props passed to every tool component */
export interface ToolComponentProps {
  className?: string;
}

/** Tool definition interface (inspired by IT-Tools defineTool + DevToys GuiToolMetadata) */
export interface ToolDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  category: ToolCategory;
  keywords: string[];
  component: () => Promise<{ default: React.ComponentType<ToolComponentProps> }>;
  createdAt?: Date;
  author?: string;
  version?: string;
  requiresTauri?: boolean;
  isBeta?: boolean;
}

/** Extended tool definition with computed properties */
export interface ToolDefinitionWithMeta extends ToolDefinition {
  readonly isNew: boolean;
}

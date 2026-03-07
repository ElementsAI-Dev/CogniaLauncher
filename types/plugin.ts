/**
 * Plugin System Types for CogniaLauncher
 * Dynamic WASM plugin loading with Extism runtime
 */

import type { ToolCompatibility, ToolOrigin } from '@/types/tool-contract';

// ============================================================================
// Plugin Manifest & Metadata
// ============================================================================

export interface PluginManifest {
  plugin: PluginMeta;
  tools: PluginToolDeclaration[];
  permissions: PluginPermissions;
  locales: Record<string, Record<string, string>>;
}

export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description: string;
  authors: string[];
  license: string | null;
  repository: string | null;
  homepage: string | null;
  minCogniaVersion: string | null;
  toolContractVersion?: string | null;
  compatibleCogniaVersions?: string | null;
  icon: { path: string } | null;
}

export interface PluginToolDeclaration {
  id: string;
  nameEn: string;
  nameZh: string | null;
  descriptionEn: string;
  descriptionZh: string | null;
  category: string;
  keywords: string[];
  icon: string;
  capabilities?: string[];
  entry: string;
  uiMode?: 'text' | 'declarative' | 'iframe';
}

// ============================================================================
// Plugin Permissions
// ============================================================================

export interface PluginPermissions {
  fsRead: string[];
  fsWrite: string[];
  http: string[];
  configRead: boolean;
  configWrite: boolean;
  envRead: boolean;
  pkgSearch: boolean;
  pkgInstall: boolean;
  clipboard: boolean;
  notification: boolean;
  processExec: boolean;
}

export interface PluginPermissionState {
  declared: PluginPermissions;
  granted: string[];
  denied: string[];
}

export type PluginPermissionMode = 'compat' | 'strict';

// ============================================================================
// Plugin Info (from registry)
// ============================================================================

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  normalizedDescription?: string | null;
  descriptionFallbackNeeded?: boolean;
  authors: string[];
  toolCount: number;
  // Card-level, bounded preview metadata derived from full tool inventory.
  toolPreviews?: PluginToolPreview[];
  // Total discoverable tool count used for overflow semantics in preview UI.
  toolPreviewCount?: number;
  // Indicates whether toolPreviewCount exceeds toolPreviews.length.
  hasMoreToolPreviews?: boolean;
  // True while tool inventory hydration is still in progress for this plugin.
  toolPreviewLoading?: boolean;
  enabled: boolean;
  installedAt: string;
  updatedAt: string | null;
  updateUrl: string | null;
  toolContractVersion?: string;
  compatibility?: ToolCompatibility;
  source: PluginSource;
  builtinCandidate: boolean;
  builtinSyncStatus: string | null;
  builtinSyncMessage: string | null;
  deprecationWarnings?: PluginDeprecationNotice[];
}

export interface PluginUpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  changelog: string | null;
}

export interface PluginHealth {
  consecutiveFailures: number;
  totalCalls: number;
  failedCalls: number;
  totalDurationMs: number;
  lastError: string | null;
  autoDisabled: boolean;
}

export interface PluginDeprecationNotice {
  code: string;
  message: string;
  guidance: string;
  severity: 'warning' | 'critical';
}

export interface PluginCapabilityAuditRecord {
  pluginId: string;
  toolEntry: string;
  permission: string;
  capability: string;
  allowed: boolean;
  timestamp: string;
  reason: string | null;
}

export interface PluginSettingDeclaration {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  labelEn: string;
  labelZh: string | null;
  descriptionEn: string | null;
  descriptionZh: string | null;
  default: unknown;
  required: boolean;
  min: number | null;
  max: number | null;
  options: PluginSettingOption[];
}

export interface PluginSettingOption {
  value: string;
  labelEn: string;
  labelZh: string | null;
}

export type PluginSource =
  | { type: 'local'; path: string }
  | { type: 'url'; url: string }
  | { type: 'store'; storeId: string }
  | { type: 'builtIn' };

// ============================================================================
// Plugin Tool Info (unified tool from plugins)
// ============================================================================

export interface PluginToolInfo {
  pluginId: string;
  pluginName: string;
  toolId: string;
  nameEn: string;
  normalizedName?: string;
  nameZh: string | null;
  descriptionEn: string;
  normalizedDescription?: string | null;
  descriptionFallbackNeeded?: boolean;
  descriptionZh: string | null;
  category: string;
  keywords: string[];
  icon: string;
  entry: string;
  uiMode: string;
  origin?: ToolOrigin;
  contractVersion?: string;
  capabilityDeclarations?: string[];
  compatibility?: ToolCompatibility;
  discoverable?: boolean;
  exclusionReason?: string | null;
  deprecationWarnings?: PluginDeprecationNotice[];
}

export interface PluginToolPreview {
  toolId: string;
  name: string;
  description: string | null;
  // True when preview description is missing and UI should render fallback copy.
  descriptionFallbackNeeded: boolean;
  entry: string;
  uiMode: string;
}

// ============================================================================
// Plugin UI Config
// ============================================================================

export interface PluginUiConfig {
  entry: string;
  width: number;
  height: number;
  resizable: boolean;
}

export interface PluginUiEntry {
  html: string;
  pluginId: string;
  permissions: string[];
}

// ============================================================================
// Scaffold & Validation
// ============================================================================

export type PluginLanguage = 'rust' | 'javascript' | 'typescript';
export type ScaffoldLifecycleProfile = 'external' | 'builtin';

export type ScaffoldContractTemplate = 'minimal' | 'advanced';
export type ScaffoldSchemaPreset = 'basic-form' | 'multi-step-flow' | 'repeatable-collection';

export interface ScaffoldTemplateOptions {
  includeUnifiedContractSamples?: boolean;
  contractTemplate?: ScaffoldContractTemplate;
  schemaPreset?: ScaffoldSchemaPreset;
  includeValidationGuidance?: boolean;
  includeStarterTests?: boolean;
}

export interface ScaffoldPermissions {
  configRead: boolean;
  envRead: boolean;
  pkgSearch: boolean;
  clipboard: boolean;
  notification: boolean;
  http: string[];
  fsRead: boolean;
  fsWrite: boolean;
  processExec: boolean;
}

export interface ScaffoldConfig {
  name: string;
  id: string;
  description: string;
  author: string;
  outputDir: string;
  license?: string;
  repository?: string;
  homepage?: string;
  lifecycleProfile?: ScaffoldLifecycleProfile;
  language: PluginLanguage;
  permissions: ScaffoldPermissions;
  includeCi?: boolean;
  includeVscode?: boolean;
  additionalKeywords?: string[];
  templateOptions?: ScaffoldTemplateOptions;
}

export interface ScaffoldHandoff {
  profile: ScaffoldLifecycleProfile;
  artifactPath: string;
  buildCommands: string[];
  nextSteps: string[];
  importPath?: string;
  importRequiresBuild: boolean;
  lifecycleManifestPath: string;
  builtinCatalogPath?: string;
  builtinChecksumCommand?: string;
  builtinValidationCommand?: string;
}

export interface ScaffoldResult {
  pluginDir: string;
  filesCreated: string[];
  lifecycleProfile: ScaffoldLifecycleProfile;
  handoff: ScaffoldHandoff;
}

export interface ScaffoldOpenResult {
  openedWith: 'vscode' | 'folder';
  fallbackUsed: boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  canImport: boolean;
  buildRequired: boolean;
  missingArtifactPath?: string;
  errors: string[];
  warnings: string[];
}

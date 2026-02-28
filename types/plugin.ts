/**
 * Plugin System Types for CogniaLauncher
 * Dynamic WASM plugin loading with Extism runtime
 */

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

// ============================================================================
// Plugin Info (from registry)
// ============================================================================

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  authors: string[];
  toolCount: number;
  enabled: boolean;
  installedAt: string;
  updatedAt: string | null;
  updateUrl: string | null;
  source: PluginSource;
}

export interface PluginUpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  changelog: string | null;
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
  nameZh: string | null;
  descriptionEn: string;
  descriptionZh: string | null;
  category: string;
  keywords: string[];
  icon: string;
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
  language: PluginLanguage;
  permissions: ScaffoldPermissions;
}

export interface ScaffoldResult {
  pluginDir: string;
  filesCreated: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

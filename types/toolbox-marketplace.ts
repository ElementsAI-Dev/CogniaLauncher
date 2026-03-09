import type {
  PluginInfo,
  PluginMarketplaceActionPhase,
  PluginUpdateInfo,
} from '@/types/plugin';

export interface ToolboxMarketplaceToolPreview {
  toolId: string;
  name: string;
  description: string | null;
  category: string;
  uiMode: string;
}

export interface ToolboxMarketplacePublisher {
  id: string | null;
  name: string;
  verified: boolean;
  url: string | null;
}

export interface ToolboxMarketplaceSupportLinks {
  homepageUrl: string | null;
  documentationUrl: string | null;
  issuesUrl: string | null;
}

export interface ToolboxMarketplaceGalleryItem {
  type: 'image';
  url: string;
  alt: string;
  caption: string | null;
}

export interface ToolboxMarketplaceSource {
  type: 'store';
  storeId: string;
  pluginDir: string;
  artifact: string;
  checksumSha256: string;
  downloadUrl: string | null;
  mirrorUrls: string[];
  sizeBytes: number | null;
}

export interface ToolboxMarketplaceListing {
  id: string;
  pluginId: string;
  name: string;
  description: string;
  version: string;
  category: string;
  featured: boolean;
  authors: string[];
  updatedAt: string | null;
  installCount: number | null;
  publisher: ToolboxMarketplacePublisher | null;
  support: ToolboxMarketplaceSupportLinks;
  highlights: string[];
  gallery: ToolboxMarketplaceGalleryItem[];
  releaseNotes: string | null;
  minimumHostVersion: string | null;
  toolContractVersion: string | null;
  source: ToolboxMarketplaceSource;
  permissions: string[];
  capabilities: string[];
  tools: ToolboxMarketplaceToolPreview[];
  desktopOnly: boolean;
}

export interface ToolboxMarketplaceCatalog {
  schemaVersion: number;
  generatedAt: string;
  listings: ToolboxMarketplaceListing[];
}

export type ToolboxMarketplaceInstallState =
  | 'not-installed'
  | 'installed'
  | 'update-available'
  | 'disabled'
  | 'blocked';

export type ToolboxMarketplaceCatalogSource = 'bundled' | 'cached' | 'remote';

export type ToolboxMarketplaceSyncState = 'idle' | 'refreshing' | 'ready' | 'degraded' | 'error';

export interface ToolboxMarketplaceResolvedListing extends ToolboxMarketplaceListing {
  installState: ToolboxMarketplaceInstallState;
  blockedReason: string | null;
  compatible: boolean;
  installedPlugin: PluginInfo | null;
  pendingUpdate: PluginUpdateInfo | null;
}

export interface ToolboxMarketplaceFilters {
  query: string;
  category: string;
  featuredOnly: boolean;
  verifiedOnly: boolean;
  installState: 'all' | ToolboxMarketplaceInstallState;
  sort: 'relevance' | 'name' | 'updated' | 'popular';
}

export type ToolboxMarketplaceActionKind = 'marketplace-install' | 'marketplace-update';

export type ToolboxMarketplaceActionErrorCategory =
  | 'compatibility_blocked'
  | 'source_unavailable'
  | 'validation_failed'
  | 'install_execution_failed';

export interface ToolboxMarketplaceActionError {
  kind: ToolboxMarketplaceActionKind;
  category: ToolboxMarketplaceActionErrorCategory;
  listingId: string;
  pluginId: string;
  toolId: string | null;
  message: string;
  retryable: boolean;
  timestamp: number;
}

export interface ToolboxMarketplaceActionProgress {
  kind: ToolboxMarketplaceActionKind;
  listingId: string;
  pluginId: string;
  phase: PluginMarketplaceActionPhase;
  downloadTaskId: string | null;
  timestamp: number;
}

export interface ToolboxContinuationHint {
  kind: ToolboxMarketplaceActionKind;
  listingId: string;
  pluginId: string;
  toolId: string | null;
  timestamp: number;
}

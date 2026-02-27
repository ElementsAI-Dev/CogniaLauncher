import {
  Download,
  Trash2,
  ArrowUp,
  RotateCcw,
  Pin,
  PinOff,
} from 'lucide-react';
import type { ComparisonFeatureKey } from '@/types/packages';

// ============================================================================
// Package Comparison
// ============================================================================

export const COMPARISON_FEATURE_KEYS: ComparisonFeatureKey[] = [
  { nameKey: 'featureVersion', key: 'version', type: 'string' },
  { nameKey: 'featureProvider', key: 'provider', type: 'string' },
  { nameKey: 'featureLicense', key: 'license', type: 'string' },
  { nameKey: 'featureSize', key: 'size', type: 'size' },
  { nameKey: 'featureLastUpdated', key: 'updated_at', type: 'string' },
  { nameKey: 'featureHomepage', key: 'homepage', type: 'string' },
  { nameKey: 'featureDependencies', key: 'dependencies', type: 'array' },
  { nameKey: 'featurePlatforms', key: 'platforms', type: 'array' },
];

// ============================================================================
// Version List
// ============================================================================

export const VERSIONS_PER_PAGE = 30;

// ============================================================================
// History Action Icons
// ============================================================================

export const ACTION_ICONS: Record<string, typeof Download> = {
  install: Download,
  uninstall: Trash2,
  update: ArrowUp,
  rollback: RotateCcw,
  pin: Pin,
  unpin: PinOff,
};

// ============================================================================
// Dependency Tree
// ============================================================================

export const DEPTH_COLORS = [
  'border-l-primary',
  'border-l-blue-500',
  'border-l-green-500',
  'border-l-yellow-500',
  'border-l-purple-500',
  'border-l-pink-500',
];

// ============================================================================
// Search History
// ============================================================================

export const SEARCH_HISTORY_KEY = 'cognia-search-history';
export const MAX_SEARCH_HISTORY = 10;

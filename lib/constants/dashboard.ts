/**
 * Dashboard constants for CogniaLauncher
 * Extracted from components/dashboard/ for better code organization
 */

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
} from 'lucide-react';
import type { WidgetSize } from '@/lib/stores/dashboard';
import type { HealthStatus } from '@/types/tauri';

// ============================================================================
// Quick Search Constants
// ============================================================================

export const SEARCH_HISTORY_KEY = "cognia-dashboard-search-history";
export const MAX_HISTORY = 5;

// ============================================================================
// Widget Size Classes
// ============================================================================

export const WIDGET_SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-1 lg:col-span-1",
  lg: "col-span-1 lg:col-span-2",
  full: "col-span-1 lg:col-span-2",
};

// ============================================================================
// Health Check Status Configuration
// ============================================================================

export const HEALTH_STATUS_CONFIG: Record<HealthStatus, { icon: typeof ShieldCheck; color: string }> = {
  healthy: { icon: ShieldCheck, color: 'text-green-600' },
  warning: { icon: ShieldAlert, color: 'text-yellow-600' },
  error: { icon: ShieldX, color: 'text-red-600' },
  unknown: { icon: ShieldQuestion, color: 'text-muted-foreground' },
};

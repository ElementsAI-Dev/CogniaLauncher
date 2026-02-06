import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  visible: boolean;
}

export type WidgetType =
  | 'stats-overview'
  | 'environment-chart'
  | 'package-chart'
  | 'cache-usage'
  | 'activity-timeline'
  | 'system-info'
  | 'download-stats'
  | 'quick-search'
  | 'environment-list'
  | 'package-list'
  | 'quick-actions'
  | 'wsl-status'
  | 'health-check'
  | 'updates-available'
  | 'welcome';

export interface WidgetDefinition {
  type: WidgetType;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  category: 'overview' | 'charts' | 'lists' | 'tools';
}

export const WIDGET_DEFINITIONS: Record<WidgetType, WidgetDefinition> = {
  'stats-overview': {
    type: 'stats-overview',
    titleKey: 'dashboard.widgets.statsOverview',
    descriptionKey: 'dashboard.widgets.statsOverviewDesc',
    icon: 'BarChart3',
    defaultSize: 'full',
    minSize: 'full',
    category: 'overview',
  },
  'environment-chart': {
    type: 'environment-chart',
    titleKey: 'dashboard.widgets.environmentChart',
    descriptionKey: 'dashboard.widgets.environmentChartDesc',
    icon: 'PieChart',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
  },
  'package-chart': {
    type: 'package-chart',
    titleKey: 'dashboard.widgets.packageChart',
    descriptionKey: 'dashboard.widgets.packageChartDesc',
    icon: 'BarChart',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
  },
  'cache-usage': {
    type: 'cache-usage',
    titleKey: 'dashboard.widgets.cacheUsage',
    descriptionKey: 'dashboard.widgets.cacheUsageDesc',
    icon: 'HardDrive',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
  },
  'activity-timeline': {
    type: 'activity-timeline',
    titleKey: 'dashboard.widgets.distributionOverview',
    descriptionKey: 'dashboard.widgets.distributionOverviewDesc',
    icon: 'Activity',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
  },
  'system-info': {
    type: 'system-info',
    titleKey: 'dashboard.widgets.systemInfo',
    descriptionKey: 'dashboard.widgets.systemInfoDesc',
    icon: 'Monitor',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
  },
  'download-stats': {
    type: 'download-stats',
    titleKey: 'dashboard.widgets.downloadStats',
    descriptionKey: 'dashboard.widgets.downloadStatsDesc',
    icon: 'Download',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
  },
  'quick-search': {
    type: 'quick-search',
    titleKey: 'dashboard.widgets.quickSearch',
    descriptionKey: 'dashboard.widgets.quickSearchDesc',
    icon: 'Search',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'tools',
  },
  'environment-list': {
    type: 'environment-list',
    titleKey: 'dashboard.widgets.environmentList',
    descriptionKey: 'dashboard.widgets.environmentListDesc',
    icon: 'Layers',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'lists',
  },
  'package-list': {
    type: 'package-list',
    titleKey: 'dashboard.widgets.packageList',
    descriptionKey: 'dashboard.widgets.packageListDesc',
    icon: 'Package',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'lists',
  },
  'quick-actions': {
    type: 'quick-actions',
    titleKey: 'dashboard.widgets.quickActions',
    descriptionKey: 'dashboard.widgets.quickActionsDesc',
    icon: 'Zap',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'tools',
  },
  'wsl-status': {
    type: 'wsl-status',
    titleKey: 'dashboard.widgets.wslStatus',
    descriptionKey: 'dashboard.widgets.wslStatusDesc',
    icon: 'Terminal',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
  },
  'health-check': {
    type: 'health-check',
    titleKey: 'dashboard.widgets.healthCheck',
    descriptionKey: 'dashboard.widgets.healthCheckDesc',
    icon: 'ShieldCheck',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
  },
  'updates-available': {
    type: 'updates-available',
    titleKey: 'dashboard.widgets.updatesAvailable',
    descriptionKey: 'dashboard.widgets.updatesAvailableDesc',
    icon: 'ArrowUpCircle',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
  },
  'welcome': {
    type: 'welcome',
    titleKey: 'dashboard.widgets.welcomeTitle',
    descriptionKey: 'dashboard.widgets.welcomeDesc',
    icon: 'Sparkles',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'overview',
  },
};

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'w-welcome', type: 'welcome', size: 'full', visible: true },
  { id: 'w-stats', type: 'stats-overview', size: 'full', visible: true },
  { id: 'w-search', type: 'quick-search', size: 'full', visible: true },
  { id: 'w-health', type: 'health-check', size: 'md', visible: true },
  { id: 'w-updates', type: 'updates-available', size: 'md', visible: true },
  { id: 'w-env-chart', type: 'environment-chart', size: 'md', visible: true },
  { id: 'w-pkg-chart', type: 'package-chart', size: 'md', visible: true },
  { id: 'w-envs', type: 'environment-list', size: 'md', visible: true },
  { id: 'w-pkgs', type: 'package-list', size: 'md', visible: true },
  { id: 'w-cache', type: 'cache-usage', size: 'md', visible: true },
  { id: 'w-activity', type: 'activity-timeline', size: 'md', visible: true },
  { id: 'w-system', type: 'system-info', size: 'md', visible: true },
  { id: 'w-downloads', type: 'download-stats', size: 'md', visible: true },
  { id: 'w-wsl', type: 'wsl-status', size: 'md', visible: true },
];

interface DashboardState {
  widgets: WidgetConfig[];
  isCustomizing: boolean;
  isEditMode: boolean;

  // Actions
  setWidgets: (widgets: WidgetConfig[]) => void;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  reorderWidgets: (oldIndex: number, newIndex: number) => void;
  toggleWidgetVisibility: (id: string) => void;
  setIsCustomizing: (value: boolean) => void;
  setIsEditMode: (value: boolean) => void;
  resetToDefault: () => void;
}

let widgetCounter = 0;

function generateWidgetId(type: WidgetType): string {
  widgetCounter += 1;
  return `w-${type}-${Date.now()}-${widgetCounter}`;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      isCustomizing: false,
      isEditMode: false,

      setWidgets: (widgets) => set({ widgets }),

      addWidget: (type) =>
        set((state) => {
          const def = WIDGET_DEFINITIONS[type];
          const newWidget: WidgetConfig = {
            id: generateWidgetId(type),
            type,
            size: def.defaultSize,
            visible: true,
          };
          return { widgets: [...state.widgets, newWidget] };
        }),

      removeWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
        })),

      updateWidget: (id, updates) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, ...updates } : w,
          ),
        })),

      reorderWidgets: (oldIndex, newIndex) =>
        set((state) => {
          const newWidgets = [...state.widgets];
          const [removed] = newWidgets.splice(oldIndex, 1);
          newWidgets.splice(newIndex, 0, removed);
          return { widgets: newWidgets };
        }),

      toggleWidgetVisibility: (id) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w,
          ),
        })),

      setIsCustomizing: (isCustomizing) => set({ isCustomizing }),

      setIsEditMode: (isEditMode) => set({ isEditMode }),

      resetToDefault: () => set({ widgets: DEFAULT_WIDGETS }),
    }),
    {
      name: 'cognia-dashboard',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) {
          // Add new widgets that didn't exist in v1
          const state = persistedState as { widgets: WidgetConfig[] };
          const existingTypes = new Set(state.widgets.map((w) => w.type));
          if (!existingTypes.has('health-check')) {
            state.widgets.splice(3, 0, { id: 'w-health', type: 'health-check', size: 'md', visible: true });
          }
          if (!existingTypes.has('updates-available')) {
            state.widgets.splice(4, 0, { id: 'w-updates', type: 'updates-available', size: 'md', visible: true });
          }
          if (!existingTypes.has('welcome')) {
            state.widgets.unshift({ id: 'w-welcome', type: 'welcome', size: 'full', visible: true });
          }
        }
        return persistedState as DashboardState;
      },
      partialize: (state) => ({
        widgets: state.widgets,
      }),
    },
  ),
);

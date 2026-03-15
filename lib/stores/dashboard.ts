import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export type DashboardDataSource =
  | 'activity'
  | 'downloads'
  | 'environments'
  | 'health'
  | 'packages'
  | 'settings'
  | 'toolbox';

export type WidgetRange = '7d' | '30d';
export type WorkspaceTrendMetric = 'installations' | 'downloads' | 'updates';
export type ProviderHealthGroupBy = 'provider' | 'environment';

export interface AttentionCenterSettings {
  maxItems: 3 | 5;
}

export interface WorkspaceTrendsSettings {
  range: WidgetRange;
  metric: WorkspaceTrendMetric;
}

export interface ProviderHealthMatrixSettings {
  groupBy: ProviderHealthGroupBy;
  showHealthy: boolean;
}

export interface RecentActivityFeedSettings {
  limit: 5 | 10;
}

export interface WidgetSettingsMap {
  'attention-center': AttentionCenterSettings;
  'workspace-trends': WorkspaceTrendsSettings;
  'provider-health-matrix': ProviderHealthMatrixSettings;
  'recent-activity-feed': RecentActivityFeedSettings;
}

export type WidgetSettings = WidgetSettingsMap[keyof WidgetSettingsMap];

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  visible: boolean;
  settings?: WidgetSettings;
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
  | 'welcome'
  | 'toolbox-favorites'
  | 'attention-center'
  | 'workspace-trends'
  | 'provider-health-matrix'
  | 'recent-activity-feed';

interface WidgetPolicy {
  allowMultiple: boolean;
  required: boolean;
  defaultVisible: boolean;
  maxInstances?: number;
}

export interface WidgetDefinition extends WidgetPolicy {
  type: WidgetType;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  category: 'overview' | 'charts' | 'lists' | 'tools';
  dataSources: DashboardDataSource[];
  defaultSettings?: WidgetSettings;
}

const SINGLE_INSTANCE_POLICY: WidgetPolicy = {
  allowMultiple: false,
  required: false,
  defaultVisible: true,
  maxInstances: 1,
};

const MULTI_INSTANCE_POLICY: WidgetPolicy = {
  allowMultiple: true,
  required: false,
  defaultVisible: true,
};

export const WIDGET_DEFINITIONS: Record<WidgetType, WidgetDefinition> = {
  'stats-overview': {
    type: 'stats-overview',
    titleKey: 'dashboard.widgets.statsOverview',
    descriptionKey: 'dashboard.widgets.statsOverviewDesc',
    icon: 'BarChart3',
    defaultSize: 'full',
    minSize: 'full',
    category: 'overview',
    dataSources: ['environments', 'packages', 'settings'],
    ...SINGLE_INSTANCE_POLICY,
  },
  'environment-chart': {
    type: 'environment-chart',
    titleKey: 'dashboard.widgets.environmentChart',
    descriptionKey: 'dashboard.widgets.environmentChartDesc',
    icon: 'PieChart',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
    dataSources: ['environments'],
    ...MULTI_INSTANCE_POLICY,
  },
  'package-chart': {
    type: 'package-chart',
    titleKey: 'dashboard.widgets.packageChart',
    descriptionKey: 'dashboard.widgets.packageChartDesc',
    icon: 'BarChart',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
    dataSources: ['packages'],
    ...MULTI_INSTANCE_POLICY,
  },
  'cache-usage': {
    type: 'cache-usage',
    titleKey: 'dashboard.widgets.cacheUsage',
    descriptionKey: 'dashboard.widgets.cacheUsageDesc',
    icon: 'HardDrive',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
    dataSources: ['settings'],
    ...MULTI_INSTANCE_POLICY,
  },
  'activity-timeline': {
    type: 'activity-timeline',
    titleKey: 'dashboard.widgets.distributionOverview',
    descriptionKey: 'dashboard.widgets.distributionOverviewDesc',
    icon: 'Activity',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
    dataSources: ['activity', 'environments', 'packages'],
    ...MULTI_INSTANCE_POLICY,
  },
  'system-info': {
    type: 'system-info',
    titleKey: 'dashboard.widgets.systemInfo',
    descriptionKey: 'dashboard.widgets.systemInfoDesc',
    icon: 'Monitor',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
    dataSources: ['settings'],
    ...SINGLE_INSTANCE_POLICY,
  },
  'download-stats': {
    type: 'download-stats',
    titleKey: 'dashboard.widgets.downloadStats',
    descriptionKey: 'dashboard.widgets.downloadStatsDesc',
    icon: 'Download',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'charts',
    dataSources: ['downloads'],
    ...MULTI_INSTANCE_POLICY,
  },
  'quick-search': {
    type: 'quick-search',
    titleKey: 'dashboard.widgets.quickSearch',
    descriptionKey: 'dashboard.widgets.quickSearchDesc',
    icon: 'Search',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'tools',
    dataSources: ['environments', 'packages', 'toolbox'],
    ...SINGLE_INSTANCE_POLICY,
  },
  'environment-list': {
    type: 'environment-list',
    titleKey: 'dashboard.widgets.environmentList',
    descriptionKey: 'dashboard.widgets.environmentListDesc',
    icon: 'Layers',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'lists',
    dataSources: ['environments'],
    ...MULTI_INSTANCE_POLICY,
  },
  'package-list': {
    type: 'package-list',
    titleKey: 'dashboard.widgets.packageList',
    descriptionKey: 'dashboard.widgets.packageListDesc',
    icon: 'Package',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'lists',
    dataSources: ['packages'],
    ...MULTI_INSTANCE_POLICY,
  },
  'quick-actions': {
    type: 'quick-actions',
    titleKey: 'dashboard.widgets.quickActions',
    descriptionKey: 'dashboard.widgets.quickActionsDesc',
    icon: 'Zap',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'tools',
    dataSources: [],
    ...MULTI_INSTANCE_POLICY,
  },
  'wsl-status': {
    type: 'wsl-status',
    titleKey: 'dashboard.widgets.wslStatus',
    descriptionKey: 'dashboard.widgets.wslStatusDesc',
    icon: 'Terminal',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
    dataSources: ['settings'],
    ...SINGLE_INSTANCE_POLICY,
  },
  'health-check': {
    type: 'health-check',
    titleKey: 'dashboard.widgets.healthCheck',
    descriptionKey: 'dashboard.widgets.healthCheckDesc',
    icon: 'ShieldCheck',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
    dataSources: ['health'],
    ...SINGLE_INSTANCE_POLICY,
  },
  'updates-available': {
    type: 'updates-available',
    titleKey: 'dashboard.widgets.updatesAvailable',
    descriptionKey: 'dashboard.widgets.updatesAvailableDesc',
    icon: 'ArrowUpCircle',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
    dataSources: ['environments', 'packages'],
    ...SINGLE_INSTANCE_POLICY,
  },
  'welcome': {
    type: 'welcome',
    titleKey: 'dashboard.widgets.welcomeTitle',
    descriptionKey: 'dashboard.widgets.welcomeDesc',
    icon: 'Sparkles',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'overview',
    dataSources: ['environments', 'packages', 'settings'],
    ...SINGLE_INSTANCE_POLICY,
  },
  'toolbox-favorites': {
    type: 'toolbox-favorites',
    titleKey: 'dashboard.widgets.toolboxFavorites',
    descriptionKey: 'dashboard.widgets.toolboxFavoritesDesc',
    icon: 'Wrench',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'tools',
    dataSources: ['toolbox'],
    ...MULTI_INSTANCE_POLICY,
  },
  'attention-center': {
    type: 'attention-center',
    titleKey: 'dashboard.widgets.attentionCenter',
    descriptionKey: 'dashboard.widgets.attentionCenterDesc',
    icon: 'BellRing',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
    dataSources: ['downloads', 'health', 'packages', 'settings'],
    defaultSettings: {
      maxItems: 3,
    },
    ...SINGLE_INSTANCE_POLICY,
  },
  'workspace-trends': {
    type: 'workspace-trends',
    titleKey: 'dashboard.widgets.workspaceTrends',
    descriptionKey: 'dashboard.widgets.workspaceTrendsDesc',
    icon: 'ChartNoAxesCombined',
    defaultSize: 'lg',
    minSize: 'md',
    category: 'charts',
    dataSources: ['activity', 'downloads', 'packages'],
    defaultSettings: {
      range: '7d',
      metric: 'installations',
    },
    ...MULTI_INSTANCE_POLICY,
  },
  'provider-health-matrix': {
    type: 'provider-health-matrix',
    titleKey: 'dashboard.widgets.providerHealthMatrix',
    descriptionKey: 'dashboard.widgets.providerHealthMatrixDesc',
    icon: 'ShieldEllipsis',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'overview',
    dataSources: ['health'],
    defaultSettings: {
      groupBy: 'provider',
      showHealthy: true,
    },
    ...MULTI_INSTANCE_POLICY,
  },
  'recent-activity-feed': {
    type: 'recent-activity-feed',
    titleKey: 'dashboard.widgets.recentActivityFeed',
    descriptionKey: 'dashboard.widgets.recentActivityFeedDesc',
    icon: 'History',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'lists',
    dataSources: ['activity', 'downloads', 'packages', 'toolbox'],
    defaultSettings: {
      limit: 5,
    },
    ...MULTI_INSTANCE_POLICY,
  },
};

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'w-welcome', type: 'welcome', size: 'full', visible: true },
  { id: 'w-stats', type: 'stats-overview', size: 'full', visible: true },
  {
    id: 'w-attention',
    type: 'attention-center',
    size: 'md',
    visible: true,
    settings: { maxItems: 3 },
  },
  {
    id: 'w-health-matrix',
    type: 'provider-health-matrix',
    size: 'md',
    visible: true,
    settings: { groupBy: 'provider', showHealthy: true },
  },
  {
    id: 'w-trends',
    type: 'workspace-trends',
    size: 'lg',
    visible: true,
    settings: { range: '7d', metric: 'installations' },
  },
  { id: 'w-actions', type: 'quick-actions', size: 'full', visible: true },
  { id: 'w-search', type: 'quick-search', size: 'full', visible: true },
  { id: 'w-health', type: 'health-check', size: 'md', visible: true },
  { id: 'w-updates', type: 'updates-available', size: 'md', visible: true },
  {
    id: 'w-recent-activity',
    type: 'recent-activity-feed',
    size: 'md',
    visible: true,
    settings: { limit: 5 },
  },
  { id: 'w-system', type: 'system-info', size: 'md', visible: true },
  { id: 'w-envs', type: 'environment-list', size: 'md', visible: true },
  { id: 'w-pkgs', type: 'package-list', size: 'md', visible: true },
  { id: 'w-env-chart', type: 'environment-chart', size: 'md', visible: true },
  { id: 'w-pkg-chart', type: 'package-chart', size: 'md', visible: true },
  { id: 'w-cache', type: 'cache-usage', size: 'md', visible: true },
  { id: 'w-activity', type: 'activity-timeline', size: 'md', visible: true },
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

type PersistedDashboardState = {
  widgets?: unknown;
};

const WIDGET_SIZE_SET = new Set<WidgetSize>(['sm', 'md', 'lg', 'full']);

let widgetCounter = 0;

function cloneWidgetSettings(settings: WidgetSettings | undefined): WidgetSettings | undefined {
  return settings ? { ...settings } : undefined;
}

function cloneWidget(widget: WidgetConfig): WidgetConfig {
  return {
    ...widget,
    settings: cloneWidgetSettings(widget.settings),
  };
}

export function getDefaultWidgets(): WidgetConfig[] {
  return DEFAULT_WIDGETS.map(cloneWidget);
}

function getWidgetDefinition(type: WidgetType): WidgetDefinition {
  return WIDGET_DEFINITIONS[type];
}

export function getDefaultWidgetSettings(type: WidgetType): WidgetSettings | undefined {
  return cloneWidgetSettings(getWidgetDefinition(type).defaultSettings);
}

function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === 'string' && WIDGET_SIZE_SET.has(value as WidgetSize);
}

function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && value in WIDGET_DEFINITIONS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWidgetSettings(type: WidgetType, value: unknown): WidgetSettings | undefined {
  const defaultSettings = getDefaultWidgetSettings(type);
  if (!defaultSettings) {
    return undefined;
  }

  const raw = isRecord(value) ? value : {};

  switch (type) {
    case 'attention-center':
      return {
        maxItems: raw.maxItems === 5 ? 5 : 3,
      };
    case 'workspace-trends':
      return {
        range: raw.range === '30d' ? '30d' : '7d',
        metric: raw.metric === 'downloads' || raw.metric === 'updates' ? raw.metric : 'installations',
      };
    case 'provider-health-matrix':
      return {
        groupBy: raw.groupBy === 'environment' ? 'environment' : 'provider',
        showHealthy: typeof raw.showHealthy === 'boolean' ? raw.showHealthy : true,
      };
    case 'recent-activity-feed':
      return {
        limit: raw.limit === 10 ? 10 : 5,
      };
    default:
      return defaultSettings;
  }
}

function ensureUniqueId(id: string, usedIds: Set<string>): string {
  if (!usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }

  let next = 2;
  let candidate = `${id}-${next}`;
  while (usedIds.has(candidate)) {
    next += 1;
    candidate = `${id}-${next}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizeLegacyWidgetsV1(rawWidgets: unknown): unknown[] {
  if (!Array.isArray(rawWidgets)) {
    return [];
  }

  const widgets = [...rawWidgets];
  const existingTypes = new Set(
    widgets
      .map((item) => (item && typeof item === 'object' ? (item as { type?: unknown }).type : undefined))
      .filter((type): type is WidgetType => isWidgetType(type)),
  );

  if (!existingTypes.has('health-check')) {
    widgets.splice(3, 0, { id: 'w-health', type: 'health-check', size: 'md', visible: true });
  }
  if (!existingTypes.has('updates-available')) {
    widgets.splice(4, 0, { id: 'w-updates', type: 'updates-available', size: 'md', visible: true });
  }
  if (!existingTypes.has('welcome')) {
    widgets.unshift({ id: 'w-welcome', type: 'welcome', size: 'full', visible: true });
  }

  return widgets;
}

function withPolicyConstraints(widgets: WidgetConfig[]): WidgetConfig[] {
  const constrained: WidgetConfig[] = [];
  const typeCounts = new Map<WidgetType, number>();

  for (const widget of widgets) {
    const def = getWidgetDefinition(widget.type);
    const count = typeCounts.get(widget.type) ?? 0;
    const maxInstances = def.maxInstances ?? (def.allowMultiple ? Number.POSITIVE_INFINITY : 1);
    if (count >= maxInstances) {
      continue;
    }
    constrained.push(widget);
    typeCounts.set(widget.type, count + 1);
  }

  for (const def of Object.values(WIDGET_DEFINITIONS)) {
    if (!def.required) {
      continue;
    }

    const requiredCount = typeCounts.get(def.type) ?? 0;
    if (requiredCount > 0) {
      continue;
    }

    const fallback = DEFAULT_WIDGETS.find((widget) => widget.type === def.type);
    const restored = fallback
      ? cloneWidget(fallback)
      : {
          id: `w-${def.type}-required`,
          type: def.type,
          size: def.defaultSize,
          visible: def.defaultVisible,
        };

    restored.id = ensureUniqueId(restored.id, new Set(constrained.map((item) => item.id)));
    constrained.push(restored);
    typeCounts.set(def.type, 1);
  }

  return constrained;
}

export function normalizeDashboardWidgets(rawWidgets: unknown): WidgetConfig[] {
  if (!Array.isArray(rawWidgets)) {
    return getDefaultWidgets();
  }

  const normalized: WidgetConfig[] = [];
  const usedIds = new Set<string>();

  rawWidgets.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as Record<string, unknown>;
    if (!isWidgetType(raw.type)) {
      return;
    }

    const def = getWidgetDefinition(raw.type);

    const baseId = typeof raw.id === 'string' && raw.id.trim().length > 0
      ? raw.id.trim()
      : `w-${raw.type}-restored-${index + 1}`;

    normalized.push({
      id: ensureUniqueId(baseId, usedIds),
      type: raw.type,
      size: isWidgetSize(raw.size) ? raw.size : def.defaultSize,
      visible: typeof raw.visible === 'boolean' ? raw.visible : def.defaultVisible,
      settings: normalizeWidgetSettings(raw.type, raw.settings),
    });
  });

  const constrained = withPolicyConstraints(normalized);
  if (constrained.length === 0) {
    return getDefaultWidgets();
  }

  return constrained;
}

function generateWidgetId(type: WidgetType): string {
  widgetCounter += 1;
  return `w-${type}-${Date.now()}-${widgetCounter}`;
}

export function getWidgetTypeCount(widgets: readonly WidgetConfig[], type: WidgetType): number {
  return widgets.reduce((count, widget) => (widget.type === type ? count + 1 : count), 0);
}

export function canAddWidgetType(widgets: readonly WidgetConfig[], type: WidgetType): boolean {
  const def = getWidgetDefinition(type);
  const count = getWidgetTypeCount(widgets, type);
  const maxInstances = def.maxInstances ?? (def.allowMultiple ? Number.POSITIVE_INFINITY : 1);
  return count < maxInstances;
}

export function canRemoveWidgetById(widgets: readonly WidgetConfig[], id: string): boolean {
  const target = widgets.find((widget) => widget.id === id);
  if (!target) {
    return false;
  }

  const def = getWidgetDefinition(target.type);
  if (!def.required) {
    return true;
  }

  return getWidgetTypeCount(widgets, target.type) > 1;
}

export function canToggleWidgetVisibilityById(widgets: readonly WidgetConfig[], id: string): boolean {
  const target = widgets.find((widget) => widget.id === id);
  if (!target) {
    return false;
  }

  const def = getWidgetDefinition(target.type);
  if (!def.required) {
    return true;
  }

  if (!target.visible) {
    return true;
  }

  const visibleCount = widgets.filter((widget) => widget.type === target.type && widget.visible).length;
  return visibleCount > 1;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: getDefaultWidgets(),
      isCustomizing: false,
      isEditMode: false,

      setWidgets: (widgets) => set({ widgets: normalizeDashboardWidgets(widgets) }),

      addWidget: (type) =>
        set((state) => {
          if (!canAddWidgetType(state.widgets, type)) {
            return state;
          }

          const def = getWidgetDefinition(type);
          const newWidget: WidgetConfig = {
            id: generateWidgetId(type),
            type,
            size: def.defaultSize,
            visible: def.defaultVisible,
            settings: getDefaultWidgetSettings(type),
          };

          return { widgets: [...state.widgets, newWidget] };
        }),

      removeWidget: (id) =>
        set((state) => {
          if (!canRemoveWidgetById(state.widgets, id)) {
            return state;
          }

          return {
            widgets: state.widgets.filter((widget) => widget.id !== id),
          };
        }),

      updateWidget: (id, updates) =>
        set((state) => ({
          widgets: state.widgets.map((widget) => {
            if (widget.id !== id) {
              return widget;
            }

            const next: WidgetConfig = {
              ...widget,
              ...updates,
            };

            if (!isWidgetSize(next.size)) {
              next.size = getWidgetDefinition(widget.type).defaultSize;
            }

            if (typeof next.visible !== 'boolean') {
              next.visible = widget.visible;
            }

            next.settings = normalizeWidgetSettings(widget.type, next.settings);

            return next;
          }),
        })),

      reorderWidgets: (oldIndex, newIndex) =>
        set((state) => {
          if (oldIndex < 0 || newIndex < 0 || oldIndex >= state.widgets.length || newIndex >= state.widgets.length) {
            return state;
          }

          const newWidgets = [...state.widgets];
          const [removed] = newWidgets.splice(oldIndex, 1);
          newWidgets.splice(newIndex, 0, removed);
          return { widgets: newWidgets };
        }),

      toggleWidgetVisibility: (id) =>
        set((state) => {
          if (!canToggleWidgetVisibilityById(state.widgets, id)) {
            return state;
          }

          return {
            widgets: state.widgets.map((widget) =>
              widget.id === id ? { ...widget, visible: !widget.visible } : widget,
            ),
          };
        }),

      setIsCustomizing: (isCustomizing) => set({ isCustomizing }),

      setIsEditMode: (isEditMode) => set({ isEditMode }),

      resetToDefault: () => set({ widgets: getDefaultWidgets() }),
    }),
    {
      name: 'cognia-dashboard',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as PersistedDashboardState;
        const widgetsSource = version < 2
          ? normalizeLegacyWidgetsV1(state.widgets)
          : state.widgets;

        return {
          widgets: normalizeDashboardWidgets(widgetsSource),
        } as DashboardState;
      },
      partialize: (state) => ({
        widgets: state.widgets,
      }),
    },
  ),
);

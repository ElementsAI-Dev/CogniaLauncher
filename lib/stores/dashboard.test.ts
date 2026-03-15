import {
  useDashboardStore,
  WIDGET_DEFINITIONS,
  canAddWidgetType,
  canRemoveWidgetById,
  canToggleWidgetVisibilityById,
  getDefaultWidgets,
  getWidgetTypeCount,
  normalizeDashboardWidgets,
} from './dashboard';
import type { WidgetConfig, WidgetType } from './dashboard';

describe('useDashboardStore', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      widgets: getDefaultWidgets(),
      isCustomizing: false,
      isEditMode: false,
    });
    localStorage.clear();
  });

  describe('WIDGET_DEFINITIONS', () => {
    it('has definitions for all widget types', () => {
      const expectedTypes = [
        'stats-overview', 'environment-chart', 'package-chart', 'cache-usage',
        'activity-timeline', 'system-info', 'download-stats', 'quick-search',
        'environment-list', 'package-list', 'quick-actions', 'wsl-status',
        'health-check', 'updates-available', 'welcome', 'toolbox-favorites',
        'attention-center', 'workspace-trends', 'provider-health-matrix', 'recent-activity-feed',
      ] as const;

      for (const type of expectedTypes) {
        const definition = WIDGET_DEFINITIONS[type as WidgetType];
        expect(definition).toBeDefined();
        expect(definition.type).toBe(type);
        expect(definition.titleKey).toBeTruthy();
        expect(definition.descriptionKey).toBeTruthy();
        expect(definition.icon).toBeTruthy();
        expect(definition.defaultSize).toBeTruthy();
        expect(definition.minSize).toBeTruthy();
        expect(definition.category).toBeTruthy();
        expect(Array.isArray(definition.dataSources)).toBe(true);
        expect(typeof definition.allowMultiple).toBe('boolean');
        expect(typeof definition.required).toBe('boolean');
        expect(typeof definition.defaultVisible).toBe('boolean');
      }
    });

    it('sets single-instance policy for stats-overview', () => {
      expect(WIDGET_DEFINITIONS['stats-overview'].allowMultiple).toBe(false);
      expect(WIDGET_DEFINITIONS['stats-overview'].maxInstances).toBe(1);
    });

    it('defines default settings for configurable insight widgets', () => {
      expect(WIDGET_DEFINITIONS['workspace-trends'].defaultSettings).toEqual({
        range: '7d',
        metric: 'installations',
      });
      expect(WIDGET_DEFINITIONS['provider-health-matrix'].defaultSettings).toEqual({
        groupBy: 'provider',
        showHealthy: true,
      });
    });
  });

  describe('policy helpers', () => {
    it('returns per-type counts', () => {
      const widgets = useDashboardStore.getState().widgets;
      expect(getWidgetTypeCount(widgets, 'quick-search')).toBe(1);
      expect(getWidgetTypeCount(widgets, 'quick-actions')).toBe(1);
    });

    it('blocks adding single-instance widget when already present', () => {
      const widgets = useDashboardStore.getState().widgets;
      expect(canAddWidgetType(widgets, 'stats-overview')).toBe(false);
    });

    it('allows adding multi-instance widget repeatedly', () => {
      const widgets = useDashboardStore.getState().widgets;
      expect(canAddWidgetType(widgets, 'quick-actions')).toBe(true);
    });

    it('returns false for unknown widget id remove/toggle checks', () => {
      const widgets = useDashboardStore.getState().widgets;
      expect(canRemoveWidgetById(widgets, 'missing')).toBe(false);
      expect(canToggleWidgetVisibilityById(widgets, 'missing')).toBe(false);
    });
  });

  describe('normalizeDashboardWidgets', () => {
    it('falls back to canonical defaults when payload is unrecoverable', () => {
      const normalized = normalizeDashboardWidgets([{ foo: 'bar' }, { type: 'unknown' }]);
      expect(normalized).toEqual(getDefaultWidgets());
    });

    it('normalizes invalid fields and dedupes ids', () => {
      const normalized = normalizeDashboardWidgets([
        { id: 'dup', type: 'environment-chart', size: 'bad-size', visible: 'yes' },
        { id: 'dup', type: 'environment-chart', size: 'lg', visible: false },
      ]);

      expect(normalized).toHaveLength(2);
      expect(normalized[0].id).toBe('dup');
      expect(normalized[1].id).toBe('dup-2');
      expect(normalized[0].size).toBe(WIDGET_DEFINITIONS['environment-chart'].defaultSize);
      expect(normalized[0].visible).toBe(WIDGET_DEFINITIONS['environment-chart'].defaultVisible);
      expect(normalized[1].size).toBe('lg');
      expect(normalized[1].visible).toBe(false);
    });

    it('enforces single-instance policy during normalization', () => {
      const normalized = normalizeDashboardWidgets([
        { id: 's1', type: 'stats-overview', size: 'full', visible: true },
        { id: 's2', type: 'stats-overview', size: 'full', visible: true },
      ]);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].id).toBe('s1');
    });

    it('normalizes widget-specific settings for insight widgets', () => {
      const normalized = normalizeDashboardWidgets([
        {
          id: 'trend',
          type: 'workspace-trends',
          size: 'lg',
          visible: true,
          settings: { range: '90d', metric: 'bad-metric' },
        },
        {
          id: 'matrix',
          type: 'provider-health-matrix',
          size: 'md',
          visible: true,
          settings: { groupBy: 'invalid', showHealthy: 'nope' },
        },
      ]);

      expect(normalized[0].settings).toEqual({
        range: '7d',
        metric: 'installations',
      });
      expect(normalized[1].settings).toEqual({
        groupBy: 'provider',
        showHealthy: true,
      });
    });
  });

  describe('actions', () => {
    it('exposes the canonical insight widgets in the latest default layout', () => {
      const widgets = getDefaultWidgets();
      expect(widgets.map((widget) => widget.type)).toEqual([
        'welcome',
        'stats-overview',
        'attention-center',
        'provider-health-matrix',
        'workspace-trends',
        'quick-actions',
        'quick-search',
        'health-check',
        'updates-available',
        'recent-activity-feed',
        'system-info',
        'environment-list',
        'package-list',
        'environment-chart',
        'package-chart',
        'cache-usage',
        'activity-timeline',
        'download-stats',
        'wsl-status',
      ]);
      expect(widgets.find((widget) => widget.id === 'w-trends')?.settings).toEqual({
        range: '7d',
        metric: 'installations',
      });
      expect(widgets.find((widget) => widget.id === 'w-health-matrix')?.settings).toEqual({
        groupBy: 'provider',
        showHealthy: true,
      });
    });

    it('setWidgets normalizes invalid payloads', () => {
      useDashboardStore.getState().setWidgets([
        { id: 'x', type: 'environment-chart', size: 'md', visible: true },
        { id: 'x', type: 'environment-chart', size: 'md', visible: true },
      ] as WidgetConfig[]);

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets[0].id).toBe('x');
      expect(widgets[1].id).toBe('x-2');
    });

    it('appends a new multi-instance widget with definition defaults', () => {
      const before = useDashboardStore.getState().widgets.length;
      useDashboardStore.getState().addWidget('quick-actions');

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets.length).toBe(before + 1);

      const added = widgets[widgets.length - 1];
      expect(added.type).toBe('quick-actions');
      expect(added.size).toBe(WIDGET_DEFINITIONS['quick-actions'].defaultSize);
      expect(added.visible).toBe(WIDGET_DEFINITIONS['quick-actions'].defaultVisible);
      expect(added.id).toMatch(/^w-quick-actions-/);
    });

    it('initializes configurable insight widgets with canonical default settings', () => {
      useDashboardStore.getState().addWidget('workspace-trends' as WidgetType);

      const widget = useDashboardStore.getState().widgets.find((entry) => entry.type === 'workspace-trends');
      expect(widget?.settings).toEqual({
        range: '7d',
        metric: 'installations',
      });
    });

    it('does not add a single-instance widget twice', () => {
      const before = useDashboardStore.getState().widgets.length;
      useDashboardStore.getState().addWidget('stats-overview');
      expect(useDashboardStore.getState().widgets.length).toBe(before);
    });

    it('removes widget by id', () => {
      useDashboardStore.getState().removeWidget('w-wsl');

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets.find((w) => w.id === 'w-wsl')).toBeUndefined();
    });

    it('does nothing if remove id is not found', () => {
      const before = useDashboardStore.getState().widgets.length;
      useDashboardStore.getState().removeWidget('non-existent');
      expect(useDashboardStore.getState().widgets.length).toBe(before);
    });

    it('normalizes invalid size on update', () => {
      useDashboardStore.getState().updateWidget('w-cache', { size: 'bad' as never });

      const widget = useDashboardStore.getState().widgets.find((w) => w.id === 'w-cache');
      expect(widget?.size).toBe(WIDGET_DEFINITIONS['cache-usage'].defaultSize);
    });

    it('moves widget from one position to another', () => {
      const currentIndex = useDashboardStore.getState().widgets.findIndex((widget) => widget.id === 'w-wsl');
      useDashboardStore.getState().reorderWidgets(currentIndex, 0);

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets[0].id).toBe('w-wsl');
      expect(widgets[1].id).toBe('w-welcome');
    });

    it('ignores out-of-range reorder indices', () => {
      const before = useDashboardStore.getState().widgets;
      useDashboardStore.getState().reorderWidgets(-1, 999);
      expect(useDashboardStore.getState().widgets).toEqual(before);
    });

    it('toggles widget visibility', () => {
      useDashboardStore.getState().toggleWidgetVisibility('w-stats');

      const widget = useDashboardStore.getState().widgets.find((w) => w.id === 'w-stats');
      expect(widget?.visible).toBe(false);
    });

    it('sets customization and edit mode flags', () => {
      useDashboardStore.getState().setIsCustomizing(true);
      useDashboardStore.getState().setIsEditMode(true);

      expect(useDashboardStore.getState().isCustomizing).toBe(true);
      expect(useDashboardStore.getState().isEditMode).toBe(true);
    });

    it('resets widgets to canonical defaults', () => {
      useDashboardStore.getState().removeWidget('w-stats');
      useDashboardStore.getState().addWidget('environment-chart');

      useDashboardStore.getState().resetToDefault();

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets).toEqual(getDefaultWidgets());
      expect(widgets[2].id).toBe('w-attention');
      expect(widgets[4].id).toBe('w-trends');
    });
  });

  describe('persist migration', () => {
    it('migrates v1 payload and injects legacy missing widgets', () => {
      const v1Widgets: WidgetConfig[] = [
        { id: 'w-stats', type: 'stats-overview', size: 'full', visible: true },
        { id: 'w-search', type: 'quick-search', size: 'full', visible: true },
        { id: 'w-envs', type: 'environment-list', size: 'md', visible: true },
      ];

      const persistConfig = (useDashboardStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }).persist.getOptions();

      const migrated = persistConfig.migrate({ widgets: v1Widgets }, 1) as { widgets: WidgetConfig[] };

      expect(migrated.widgets.some((w) => w.type === 'health-check')).toBe(true);
      expect(migrated.widgets.some((w) => w.type === 'updates-available')).toBe(true);
      expect(migrated.widgets.some((w) => w.type === 'welcome')).toBe(true);
    });

    it('normalizes v3 payload during v4 migration', () => {
      const v3Widgets = [
        { id: 'dup', type: 'environment-chart', size: 'md', visible: true },
        { id: 'dup', type: 'environment-chart', size: 'md', visible: true },
        { id: 'bad', type: 'unknown-widget', size: 'md', visible: true },
      ];

      const persistConfig = (useDashboardStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }).persist.getOptions();

      const migrated = persistConfig.migrate({ widgets: v3Widgets }, 3) as { widgets: WidgetConfig[] };

      expect(migrated.widgets).toHaveLength(2);
      expect(migrated.widgets[0].id).toBe('dup');
      expect(migrated.widgets[1].id).toBe('dup-2');
    });

    it('restores canonical settings for configurable insight widgets during migration', () => {
      const persistConfig = (useDashboardStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }).persist.getOptions();

      const migrated = persistConfig.migrate({
        widgets: [
          {
            id: 'trend',
            type: 'workspace-trends',
            size: 'lg',
            visible: true,
            settings: { range: 'bad', metric: 'bad' },
          },
        ],
      }, 3) as { widgets: WidgetConfig[] };

      expect(migrated.widgets[0]?.settings).toEqual({
        range: '7d',
        metric: 'installations',
      });
    });

    it('preserves existing customized layouts without injecting new canonical insight widgets', () => {
      const persistConfig = (useDashboardStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }).persist.getOptions();

      const migrated = persistConfig.migrate({
        widgets: [
          { id: 'w-stats', type: 'stats-overview', size: 'full', visible: true },
          { id: 'w-search', type: 'quick-search', size: 'full', visible: true },
        ],
      }, 3) as { widgets: WidgetConfig[] };

      expect(migrated.widgets.map((widget) => widget.type)).toEqual([
        'stats-overview',
        'quick-search',
      ]);
    });

    it('falls back to canonical defaults when payload is missing', () => {
      const persistConfig = (useDashboardStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }).persist.getOptions();

      const migrated = persistConfig.migrate({}, 2) as { widgets: WidgetConfig[] };
      expect(migrated.widgets).toEqual(getDefaultWidgets());
    });
  });
});

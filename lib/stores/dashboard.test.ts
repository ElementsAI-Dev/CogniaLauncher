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
      const expectedTypes: WidgetType[] = [
        'stats-overview', 'environment-chart', 'package-chart', 'cache-usage',
        'activity-timeline', 'system-info', 'download-stats', 'quick-search',
        'environment-list', 'package-list', 'quick-actions', 'wsl-status',
        'health-check', 'updates-available', 'welcome', 'toolbox-favorites',
      ];

      for (const type of expectedTypes) {
        expect(WIDGET_DEFINITIONS[type]).toBeDefined();
        expect(WIDGET_DEFINITIONS[type].type).toBe(type);
        expect(WIDGET_DEFINITIONS[type].titleKey).toBeTruthy();
        expect(WIDGET_DEFINITIONS[type].descriptionKey).toBeTruthy();
        expect(WIDGET_DEFINITIONS[type].icon).toBeTruthy();
        expect(WIDGET_DEFINITIONS[type].defaultSize).toBeTruthy();
        expect(WIDGET_DEFINITIONS[type].minSize).toBeTruthy();
        expect(WIDGET_DEFINITIONS[type].category).toBeTruthy();
        expect(typeof WIDGET_DEFINITIONS[type].allowMultiple).toBe('boolean');
        expect(typeof WIDGET_DEFINITIONS[type].required).toBe('boolean');
        expect(typeof WIDGET_DEFINITIONS[type].defaultVisible).toBe('boolean');
      }
    });

    it('sets single-instance policy for stats-overview', () => {
      expect(WIDGET_DEFINITIONS['stats-overview'].allowMultiple).toBe(false);
      expect(WIDGET_DEFINITIONS['stats-overview'].maxInstances).toBe(1);
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
  });

  describe('actions', () => {
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
      useDashboardStore.getState().reorderWidgets(14, 0);

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
      expect(widgets[2].id).toBe('w-actions');
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

    it('normalizes v2 payload during v3 migration', () => {
      const v2Widgets = [
        { id: 'dup', type: 'environment-chart', size: 'md', visible: true },
        { id: 'dup', type: 'environment-chart', size: 'md', visible: true },
        { id: 'bad', type: 'unknown-widget', size: 'md', visible: true },
      ];

      const persistConfig = (useDashboardStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }).persist.getOptions();

      const migrated = persistConfig.migrate({ widgets: v2Widgets }, 2) as { widgets: WidgetConfig[] };

      expect(migrated.widgets).toHaveLength(2);
      expect(migrated.widgets[0].id).toBe('dup');
      expect(migrated.widgets[1].id).toBe('dup-2');
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

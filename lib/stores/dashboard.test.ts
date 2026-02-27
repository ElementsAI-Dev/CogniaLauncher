import { useDashboardStore, WIDGET_DEFINITIONS } from './dashboard';
import type { WidgetConfig, WidgetType } from './dashboard';

describe('useDashboardStore', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      widgets: [
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
      ],
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
        'health-check', 'updates-available', 'welcome',
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
      }
    });

    it('has correct categories', () => {
      expect(WIDGET_DEFINITIONS['stats-overview'].category).toBe('overview');
      expect(WIDGET_DEFINITIONS['environment-chart'].category).toBe('charts');
      expect(WIDGET_DEFINITIONS['quick-search'].category).toBe('tools');
      expect(WIDGET_DEFINITIONS['environment-list'].category).toBe('lists');
    });
  });

  describe('initial state', () => {
    it('has default widgets', () => {
      const { widgets } = useDashboardStore.getState();
      expect(widgets.length).toBe(14);
      expect(widgets[0].type).toBe('welcome');
      expect(widgets[1].type).toBe('stats-overview');
    });

    it('has isCustomizing and isEditMode as false', () => {
      const state = useDashboardStore.getState();
      expect(state.isCustomizing).toBe(false);
      expect(state.isEditMode).toBe(false);
    });
  });

  describe('setWidgets', () => {
    it('replaces all widgets', () => {
      const newWidgets: WidgetConfig[] = [
        { id: 'w-1', type: 'stats-overview', size: 'full', visible: true },
      ];
      useDashboardStore.getState().setWidgets(newWidgets);
      expect(useDashboardStore.getState().widgets).toEqual(newWidgets);
    });
  });

  describe('addWidget', () => {
    it('appends a new widget with correct defaults', () => {
      const before = useDashboardStore.getState().widgets.length;
      useDashboardStore.getState().addWidget('quick-actions');

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets.length).toBe(before + 1);

      const added = widgets[widgets.length - 1];
      expect(added.type).toBe('quick-actions');
      expect(added.size).toBe(WIDGET_DEFINITIONS['quick-actions'].defaultSize);
      expect(added.visible).toBe(true);
      expect(added.id).toMatch(/^w-quick-actions-/);
    });
  });

  describe('removeWidget', () => {
    it('removes widget by id', () => {
      useDashboardStore.getState().removeWidget('w-wsl');

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets.find((w) => w.id === 'w-wsl')).toBeUndefined();
    });

    it('does not affect other widgets', () => {
      const before = useDashboardStore.getState().widgets.length;
      useDashboardStore.getState().removeWidget('w-wsl');
      expect(useDashboardStore.getState().widgets.length).toBe(before - 1);
    });

    it('does nothing if id not found', () => {
      const before = useDashboardStore.getState().widgets.length;
      useDashboardStore.getState().removeWidget('non-existent');
      expect(useDashboardStore.getState().widgets.length).toBe(before);
    });
  });

  describe('updateWidget', () => {
    it('updates size of a widget', () => {
      useDashboardStore.getState().updateWidget('w-cache', { size: 'lg' });

      const widget = useDashboardStore.getState().widgets.find((w) => w.id === 'w-cache');
      expect(widget?.size).toBe('lg');
    });

    it('updates visibility of a widget', () => {
      useDashboardStore.getState().updateWidget('w-stats', { visible: false });

      const widget = useDashboardStore.getState().widgets.find((w) => w.id === 'w-stats');
      expect(widget?.visible).toBe(false);
    });

    it('does not affect other widgets', () => {
      useDashboardStore.getState().updateWidget('w-cache', { size: 'lg' });

      const other = useDashboardStore.getState().widgets.find((w) => w.id === 'w-stats');
      expect(other?.size).toBe('full');
    });
  });

  describe('reorderWidgets', () => {
    it('moves widget from one position to another', () => {
      // Move w-wsl (index 13) to index 0
      useDashboardStore.getState().reorderWidgets(13, 0);

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets[0].id).toBe('w-wsl');
      expect(widgets[1].id).toBe('w-welcome');
    });

    it('moves widget forward', () => {
      // Move w-welcome (index 0) to index 2
      useDashboardStore.getState().reorderWidgets(0, 2);

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets[0].id).toBe('w-stats');
      expect(widgets[1].id).toBe('w-search');
      expect(widgets[2].id).toBe('w-welcome');
    });
  });

  describe('toggleWidgetVisibility', () => {
    it('toggles visible to false', () => {
      useDashboardStore.getState().toggleWidgetVisibility('w-stats');

      const widget = useDashboardStore.getState().widgets.find((w) => w.id === 'w-stats');
      expect(widget?.visible).toBe(false);
    });

    it('toggles visible back to true', () => {
      useDashboardStore.getState().toggleWidgetVisibility('w-stats');
      useDashboardStore.getState().toggleWidgetVisibility('w-stats');

      const widget = useDashboardStore.getState().widgets.find((w) => w.id === 'w-stats');
      expect(widget?.visible).toBe(true);
    });
  });

  describe('setIsCustomizing', () => {
    it('sets isCustomizing', () => {
      useDashboardStore.getState().setIsCustomizing(true);
      expect(useDashboardStore.getState().isCustomizing).toBe(true);

      useDashboardStore.getState().setIsCustomizing(false);
      expect(useDashboardStore.getState().isCustomizing).toBe(false);
    });
  });

  describe('setIsEditMode', () => {
    it('sets isEditMode', () => {
      useDashboardStore.getState().setIsEditMode(true);
      expect(useDashboardStore.getState().isEditMode).toBe(true);

      useDashboardStore.getState().setIsEditMode(false);
      expect(useDashboardStore.getState().isEditMode).toBe(false);
    });
  });

  describe('resetToDefault', () => {
    it('resets widgets to default list', () => {
      useDashboardStore.getState().removeWidget('w-stats');
      useDashboardStore.getState().addWidget('quick-actions');

      useDashboardStore.getState().resetToDefault();

      const widgets = useDashboardStore.getState().widgets;
      expect(widgets.length).toBe(14);
      expect(widgets[0].type).toBe('welcome');
      expect(widgets[1].type).toBe('stats-overview');
    });
  });

  describe('persist migration v1→v2', () => {
    it('adds health-check widget if missing', () => {
      const v1Widgets: WidgetConfig[] = [
        { id: 'w-stats', type: 'stats-overview', size: 'full', visible: true },
        { id: 'w-search', type: 'quick-search', size: 'full', visible: true },
        { id: 'w-envs', type: 'environment-list', size: 'md', visible: true },
      ];

      // Simulate loading persisted v1 state
      const persistConfig = (useDashboardStore as unknown as { persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } } }).persist.getOptions();
      const migrated = persistConfig.migrate({ widgets: v1Widgets }, 1) as { widgets: WidgetConfig[] };

      expect(migrated.widgets.some((w) => w.type === 'health-check')).toBe(true);
      expect(migrated.widgets.some((w) => w.type === 'updates-available')).toBe(true);
      expect(migrated.widgets.some((w) => w.type === 'welcome')).toBe(true);
    });

    it('does not add duplicates if already present', () => {
      const v1Widgets: WidgetConfig[] = [
        { id: 'w-welcome', type: 'welcome', size: 'full', visible: true },
        { id: 'w-health', type: 'health-check', size: 'md', visible: true },
        { id: 'w-updates', type: 'updates-available', size: 'md', visible: true },
      ];

      const persistConfig = (useDashboardStore as unknown as { persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } } }).persist.getOptions();
      const migrated = persistConfig.migrate({ widgets: v1Widgets }, 1) as { widgets: WidgetConfig[] };

      const welcomeCount = migrated.widgets.filter((w) => w.type === 'welcome').length;
      const healthCount = migrated.widgets.filter((w) => w.type === 'health-check').length;
      expect(welcomeCount).toBe(1);
      expect(healthCount).toBe(1);
    });

    it('skips migration for current version', () => {
      const widgets: WidgetConfig[] = [
        { id: 'w-stats', type: 'stats-overview', size: 'full', visible: true },
      ];

      const persistConfig = (useDashboardStore as unknown as { persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } } }).persist.getOptions();
      const migrated = persistConfig.migrate({ widgets }, 2) as { widgets: WidgetConfig[] };

      // No new widgets added because version is already 2
      expect(migrated.widgets.length).toBe(1);
    });
  });
});

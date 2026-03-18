export type DesktopActionSurface =
  | "tray"
  | "command_palette"
  | "quick_search"
  | "global_shortcut";

export type DesktopActionExecution = "route" | "callback" | "native";

export type DesktopActionId =
  | "toggle_window"
  | "open_command_palette"
  | "open_quick_search"
  | "toggle_logs"
  | "open_settings"
  | "open_downloads"
  | "check_updates"
  | "open_logs"
  | "manage_plugins"
  | "install_plugin"
  | "create_plugin"
  | "go_dashboard"
  | "go_toolbox"
  | "report_bug"
  | "feature_request";

export interface DesktopActionDefinition {
  id: DesktopActionId;
  titleKey: string;
  surfaces: DesktopActionSurface[];
  execution: DesktopActionExecution;
  route?: string;
  requiresWindow?: boolean;
}

export interface DesktopActionExecutionContext {
  navigate: (path: string) => void;
  ensureWindowVisible?: () => Promise<void>;
  toggleLogs?: () => void;
  openCommandPalette?: () => void;
  openQuickSearch?: () => void;
  openFeedback?: (options: { category: "bug" | "feature" }) => void;
  toggleWindow?: () => Promise<void>;
}

export const DESKTOP_ACTION_EVENT = "cognia:desktop-action";

const DESKTOP_ACTIONS: Record<DesktopActionId, DesktopActionDefinition> = {
  toggle_window: {
    id: "toggle_window",
    titleKey: "desktopActions.toggleWindow",
    surfaces: ["global_shortcut"],
    execution: "callback",
  },
  open_command_palette: {
    id: "open_command_palette",
    titleKey: "settings.desktopActions.openCommandPalette",
    surfaces: ["tray", "global_shortcut"],
    execution: "callback",
    requiresWindow: true,
  },
  open_quick_search: {
    id: "open_quick_search",
    titleKey: "settings.desktopActions.openQuickSearch",
    surfaces: ["tray", "global_shortcut"],
    execution: "callback",
    requiresWindow: true,
  },
  toggle_logs: {
    id: "toggle_logs",
    titleKey: "commandPalette.actions.toggleLogs",
    surfaces: ["tray", "command_palette", "quick_search"],
    execution: "callback",
    requiresWindow: true,
  },
  open_settings: {
    id: "open_settings",
    titleKey: "nav.settings",
    surfaces: ["tray", "command_palette", "quick_search"],
    execution: "route",
    route: "/settings",
    requiresWindow: true,
  },
  open_downloads: {
    id: "open_downloads",
    titleKey: "nav.downloads",
    surfaces: ["tray", "command_palette", "quick_search"],
    execution: "route",
    route: "/downloads",
    requiresWindow: true,
  },
  check_updates: {
    id: "check_updates",
    titleKey: "settings.trayClickCheckUpdates",
    surfaces: ["tray", "command_palette"],
    execution: "route",
    route: "/about",
    requiresWindow: true,
  },
  open_logs: {
    id: "open_logs",
    titleKey: "settings.trayMenu.openLogs",
    surfaces: ["tray"],
    execution: "native",
  },
  manage_plugins: {
    id: "manage_plugins",
    titleKey: "commandPalette.actions.managePlugins",
    surfaces: ["tray", "command_palette"],
    execution: "route",
    route: "/toolbox/plugins",
    requiresWindow: true,
  },
  install_plugin: {
    id: "install_plugin",
    titleKey: "commandPalette.actions.installPlugin",
    surfaces: ["tray", "command_palette"],
    execution: "route",
    route: "/toolbox/plugins?action=install",
    requiresWindow: true,
  },
  create_plugin: {
    id: "create_plugin",
    titleKey: "commandPalette.actions.createPlugin",
    surfaces: ["tray", "command_palette"],
    execution: "route",
    route: "/toolbox/plugins?action=scaffold",
    requiresWindow: true,
  },
  go_dashboard: {
    id: "go_dashboard",
    titleKey: "nav.dashboard",
    surfaces: ["tray", "command_palette", "quick_search"],
    execution: "route",
    route: "/",
    requiresWindow: true,
  },
  go_toolbox: {
    id: "go_toolbox",
    titleKey: "nav.toolbox",
    surfaces: ["tray", "command_palette", "quick_search"],
    execution: "route",
    route: "/toolbox",
    requiresWindow: true,
  },
  report_bug: {
    id: "report_bug",
    titleKey: "about.reportBug",
    surfaces: ["tray", "command_palette"],
    execution: "callback",
    requiresWindow: true,
  },
  feature_request: {
    id: "feature_request",
    titleKey: "about.featureRequest",
    surfaces: ["command_palette"],
    execution: "callback",
    requiresWindow: true,
  },
};

export function getDesktopAction(id: DesktopActionId): DesktopActionDefinition {
  return DESKTOP_ACTIONS[id];
}

export function getDesktopActionsForSurface(
  surface: DesktopActionSurface,
): DesktopActionDefinition[] {
  return Object.values(DESKTOP_ACTIONS).filter((action) =>
    action.surfaces.includes(surface),
  );
}

export async function executeDesktopAction(
  actionId: DesktopActionId,
  context: DesktopActionExecutionContext,
): Promise<boolean> {
  const action = getDesktopAction(actionId);
  if (!action) {
    return false;
  }

  if (action.execution === "native") {
    return false;
  }

  if (action.requiresWindow) {
    await context.ensureWindowVisible?.();
  }

  if (action.execution === "route" && action.route) {
    context.navigate(action.route);
    return true;
  }

  switch (action.id) {
    case "toggle_window":
      if (!context.toggleWindow) return false;
      await context.toggleWindow();
      return true;
    case "open_command_palette":
      if (!context.openCommandPalette) return false;
      context.openCommandPalette();
      return true;
    case "open_quick_search":
      if (!context.openQuickSearch) return false;
      context.navigate("/");
      context.openQuickSearch();
      return true;
    case "toggle_logs":
      if (!context.toggleLogs) return false;
      context.toggleLogs();
      return true;
    case "report_bug":
      if (!context.openFeedback) return false;
      context.openFeedback({ category: "bug" });
      return true;
    case "feature_request":
      if (!context.openFeedback) return false;
      context.openFeedback({ category: "feature" });
      return true;
    default:
      return false;
  }
}

export function dispatchDesktopActionEvent(actionId: DesktopActionId): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DesktopActionId>(DESKTOP_ACTION_EVENT, {
      detail: actionId,
    }),
  );
}

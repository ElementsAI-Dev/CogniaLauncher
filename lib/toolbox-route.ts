const BUILTIN_TOOL_ID_PREFIX = 'builtin:';
const PLUGIN_TOOL_ID_PREFIX = 'plugin:';

export function encodeToolIdForPath(toolId: string): string {
  return encodeURIComponent(toolId);
}

export function isPluginToolId(toolId: string): boolean {
  return toolId.startsWith(PLUGIN_TOOL_ID_PREFIX);
}

export function isBuiltInToolId(toolId: string): boolean {
  return toolId.startsWith(BUILTIN_TOOL_ID_PREFIX);
}

export function toBuiltInUnifiedToolId(toolId: string): string {
  return isBuiltInToolId(toolId) ? toolId : `${BUILTIN_TOOL_ID_PREFIX}${toolId}`;
}

export function getBuiltInIdFromToolId(toolId: string): string | null {
  if (!toolId) return null;
  if (isPluginToolId(toolId)) return null;
  if (isBuiltInToolId(toolId)) return toolId.slice(BUILTIN_TOOL_ID_PREFIX.length);
  return toolId;
}

export function shouldUseLegacyToolboxDetailRoute(toolId: string): boolean {
  return isPluginToolId(toolId) || isBuiltInToolId(toolId);
}

export function decodeToolIdFromPath(rawToolId: string): string {
  if (!rawToolId) return '';
  try {
    return decodeURIComponent(rawToolId);
  } catch {
    return rawToolId;
  }
}

export function getToolboxDetailPath(toolId: string): string {
  if (shouldUseLegacyToolboxDetailRoute(toolId)) {
    // Unified toolbox ids (plugin/builtin) include ":" and are unstable for static export dynamic params.
    // Route them through the query-based page to avoid dynamic segment export mismatches.
    return getLegacyToolboxDetailPath(toolId);
  }
  return `/toolbox/${encodeToolIdForPath(toolId)}`;
}

export function getLegacyToolboxDetailPath(toolId: string): string {
  return `/toolbox/tool?id=${encodeURIComponent(toolId)}`;
}

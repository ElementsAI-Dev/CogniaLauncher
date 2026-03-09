export function encodeToolIdForPath(toolId: string): string {
  return encodeURIComponent(toolId);
}

export function isPluginToolId(toolId: string): boolean {
  return toolId.startsWith('plugin:');
}

export function isBuiltInToolId(toolId: string): boolean {
  return toolId.startsWith('builtin:');
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
  if (isPluginToolId(toolId) || isBuiltInToolId(toolId)) {
    // Unified toolbox ids (plugin/builtin) include ":" and are unstable for static export dynamic params.
    // Route them through the query-based page to avoid dynamic segment export mismatches.
    return getLegacyToolboxDetailPath(toolId);
  }
  return `/toolbox/${encodeToolIdForPath(toolId)}`;
}

export function getLegacyToolboxDetailPath(toolId: string): string {
  return `/toolbox/tool?id=${encodeURIComponent(toolId)}`;
}

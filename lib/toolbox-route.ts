export function encodeToolIdForPath(toolId: string): string {
  return encodeURIComponent(toolId);
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
  return `/toolbox/${encodeToolIdForPath(toolId)}`;
}

export function getLegacyToolboxDetailPath(toolId: string): string {
  return `/toolbox/tool?id=${encodeURIComponent(toolId)}`;
}

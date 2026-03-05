export const PRIMARY_SIDEBAR_ITEM_IDS = [
  "environments",
  "packages",
  "providers",
  "cache",
  "downloads",
  "git",
  "envvar",
  "terminal",
  "toolbox",
  "wsl",
] as const;

export const SECONDARY_SIDEBAR_ITEM_IDS = [
  "logs",
  "docs",
  "settings",
  "about",
] as const;

export const DEFAULT_SIDEBAR_ITEM_ORDER = [
  ...PRIMARY_SIDEBAR_ITEM_IDS,
  ...SECONDARY_SIDEBAR_ITEM_IDS,
] as const;

export type PrimarySidebarItemId = (typeof PRIMARY_SIDEBAR_ITEM_IDS)[number];
export type SecondarySidebarItemId = (typeof SECONDARY_SIDEBAR_ITEM_IDS)[number];
export type SidebarItemId = (typeof DEFAULT_SIDEBAR_ITEM_ORDER)[number];

const SIDEBAR_ITEM_SET = new Set<string>(DEFAULT_SIDEBAR_ITEM_ORDER);
const PRIMARY_ITEM_SET = new Set<string>(PRIMARY_SIDEBAR_ITEM_IDS);
const SECONDARY_ITEM_SET = new Set<string>(SECONDARY_SIDEBAR_ITEM_IDS);

export const SIDEBAR_ITEM_LABEL_KEYS: Record<SidebarItemId, string> = {
  environments: "nav.environments",
  packages: "nav.packages",
  providers: "nav.providers",
  cache: "nav.cache",
  downloads: "nav.downloads",
  git: "nav.git",
  envvar: "nav.envvar",
  terminal: "nav.terminal",
  toolbox: "nav.toolbox",
  wsl: "nav.wsl",
  logs: "nav.logs",
  docs: "nav.docs",
  settings: "nav.settings",
  about: "nav.about",
};

export function isSidebarItemId(value: string): value is SidebarItemId {
  return SIDEBAR_ITEM_SET.has(value);
}

export function isPrimarySidebarItemId(value: SidebarItemId): value is PrimarySidebarItemId {
  return PRIMARY_ITEM_SET.has(value);
}

export function isSecondarySidebarItemId(value: SidebarItemId): value is SecondarySidebarItemId {
  return SECONDARY_ITEM_SET.has(value);
}

export function normalizeSidebarItemOrder(order?: readonly string[] | null): SidebarItemId[] {
  const result: SidebarItemId[] = [];
  const seen = new Set<SidebarItemId>();

  for (const rawId of order ?? []) {
    if (!isSidebarItemId(rawId) || seen.has(rawId)) {
      continue;
    }
    seen.add(rawId);
    result.push(rawId);
  }

  for (const id of DEFAULT_SIDEBAR_ITEM_ORDER) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  return result;
}

export function splitSidebarItemOrder(order?: readonly string[] | null): {
  primary: PrimarySidebarItemId[];
  secondary: SecondarySidebarItemId[];
} {
  const normalized = normalizeSidebarItemOrder(order);

  return {
    primary: normalized.filter((id): id is PrimarySidebarItemId =>
      isPrimarySidebarItemId(id),
    ),
    secondary: normalized.filter((id): id is SecondarySidebarItemId =>
      isSecondarySidebarItemId(id),
    ),
  };
}

export function moveSidebarItem(
  order: readonly string[] | undefined,
  itemId: SidebarItemId,
  direction: "up" | "down",
): SidebarItemId[] {
  const normalized = normalizeSidebarItemOrder(order);
  const { primary, secondary } = splitSidebarItemOrder(normalized);
  const isPrimary = isPrimarySidebarItemId(itemId);
  const current = isPrimary ? [...primary] : [...secondary];
  const index = current.indexOf(itemId as never);

  if (index === -1) {
    return normalized;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= current.length) {
    return normalized;
  }

  const [moved] = current.splice(index, 1);
  current.splice(targetIndex, 0, moved);

  if (isPrimary) {
    return [...(current as PrimarySidebarItemId[]), ...secondary];
  }

  return [...primary, ...(current as SecondarySidebarItemId[])];
}

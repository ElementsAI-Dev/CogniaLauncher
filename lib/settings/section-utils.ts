import type { SettingsSection } from "@/lib/constants/settings-registry";

export const SETTINGS_SECTION_IDS: SettingsSection[] = [
  "general",
  "network",
  "security",
  "mirrors",
  "appearance",
  "updates",
  "tray",
  "envvar",
  "shortcuts",
  "paths",
  "provider",
  "backup",
  "startup",
  "system",
];

export const SETTINGS_SECTION_CONFIG_PREFIXES: Record<
  SettingsSection,
  string[]
> = {
  general: ["general."],
  network: ["network."],
  security: ["security."],
  mirrors: ["mirrors."],
  appearance: ["appearance."],
  updates: ["updates."],
  tray: ["tray."],
  envvar: ["envvar."],
  shortcuts: ["shortcuts."],
  paths: ["paths."],
  provider: ["provider_settings.", "providers."],
  backup: ["backup."],
  startup: ["startup."],
  system: [],
};

export function getSectionForConfigKey(
  key: string,
): SettingsSection | undefined {
  for (const sectionId of SETTINGS_SECTION_IDS) {
    const prefixes = SETTINGS_SECTION_CONFIG_PREFIXES[sectionId];
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      return sectionId;
    }
  }
  return undefined;
}

export function getAffectedSections(keys: Iterable<string>): SettingsSection[] {
  const sections = new Set<SettingsSection>();
  for (const key of keys) {
    const sectionId = getSectionForConfigKey(key);
    if (sectionId) {
      sections.add(sectionId);
    }
  }
  return SETTINGS_SECTION_IDS.filter((sectionId) => sections.has(sectionId));
}

export function pickSectionKeys(
  source: Record<string, string>,
  sectionId: SettingsSection,
): string[] {
  const prefixes = SETTINGS_SECTION_CONFIG_PREFIXES[sectionId] ?? [];
  return Object.keys(source).filter((key) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );
}

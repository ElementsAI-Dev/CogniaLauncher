export interface InkAuthoringPrerequisite {
  id: string;
  label: string;
  satisfied: boolean;
  detail?: string | null;
}

export interface InkAuthoringSnapshotOptions<TPreview> {
  pluginId: string;
  workflowId: string;
  title: string;
  summary: string;
  preview: TPreview;
  prerequisites?: InkAuthoringPrerequisite[];
  updatedAt?: string;
}

export interface InkAuthoringSnapshot<TPreview> {
  pluginId: string;
  workflowId: string;
  title: string;
  summary: string;
  preview: TPreview;
  prerequisites: InkAuthoringPrerequisite[];
  status: 'ready' | 'blocked';
  missingPrerequisiteIds: string[];
  updatedAt: string;
}

export interface HeadlessInkHarnessOptions<TInput, TPreview>
  extends Omit<InkAuthoringSnapshotOptions<TPreview>, 'preview'> {
  simulate: (input: TInput) => Promise<TPreview> | TPreview;
}

export interface InkAuthoringPlatformInfo {
  os: string;
  arch: string;
  hostname: string;
  osVersion: string;
}

export interface InkAuthoringUiContext {
  locale: string;
  theme: string;
  windowEffect: string;
  desktop: boolean;
  inAppEffects: boolean;
}

export interface InkAuthoringHostAdapter<TServices> {
  pluginId: string;
  platform: InkAuthoringPlatformInfo;
  uiContext: InkAuthoringUiContext;
  prerequisites: InkAuthoringPrerequisite[];
  services: TServices;
}

function uniquePrerequisites(
  prerequisites: InkAuthoringPrerequisite[] = [],
): InkAuthoringPrerequisite[] {
  const seen = new Set<string>();
  const normalized: InkAuthoringPrerequisite[] = [];

  for (const prerequisite of prerequisites) {
    const id = prerequisite.id.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push({
      id,
      label: prerequisite.label.trim(),
      satisfied: prerequisite.satisfied,
      detail: prerequisite.detail?.trim() || undefined,
    });
  }

  return normalized;
}

export function buildInkAuthoringSnapshot<TPreview>(
  options: InkAuthoringSnapshotOptions<TPreview>,
): InkAuthoringSnapshot<TPreview> {
  const prerequisites = uniquePrerequisites(options.prerequisites);
  const missingPrerequisiteIds = prerequisites
    .filter((prerequisite) => !prerequisite.satisfied)
    .map((prerequisite) => prerequisite.id);

  return {
    pluginId: options.pluginId,
    workflowId: options.workflowId,
    title: options.title,
    summary: options.summary,
    preview: options.preview,
    prerequisites,
    status: missingPrerequisiteIds.length > 0 ? 'blocked' : 'ready',
    missingPrerequisiteIds,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
  };
}

export function createInkAuthoringHostAdapter<TServices>(options: {
  pluginId: string;
  services: TServices;
  platform?: Partial<InkAuthoringPlatformInfo>;
  uiContext?: Partial<InkAuthoringUiContext>;
  prerequisites?: InkAuthoringPrerequisite[];
}): InkAuthoringHostAdapter<TServices> {
  return {
    pluginId: options.pluginId,
    platform: {
      os: options.platform?.os ?? 'windows',
      arch: options.platform?.arch ?? 'x64',
      hostname: options.platform?.hostname ?? 'authoring-host',
      osVersion: options.platform?.osVersion ?? '11',
    },
    uiContext: {
      locale: options.uiContext?.locale ?? 'en',
      theme: options.uiContext?.theme ?? 'system',
      windowEffect: options.uiContext?.windowEffect ?? 'mica',
      desktop: options.uiContext?.desktop ?? true,
      inAppEffects: options.uiContext?.inAppEffects ?? true,
    },
    prerequisites: uniquePrerequisites(options.prerequisites),
    services: options.services,
  };
}

export function createHeadlessInkHarness<TInput, TPreview>(
  options: HeadlessInkHarnessOptions<TInput, TPreview>,
) {
  return {
    async run(input: TInput): Promise<InkAuthoringSnapshot<TPreview>> {
      const preview = await options.simulate(input);
      return buildInkAuthoringSnapshot({
        ...options,
        preview,
      });
    },
  };
}

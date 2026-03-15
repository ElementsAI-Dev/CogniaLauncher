import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WslNetworkPreset } from '@/lib/constants/wsl';
import type { WslBatchWorkflowPreset, WslBatchWorkflowSummary } from '@/types/wsl';
import {
  DEFAULT_WSL_OVERVIEW_CONTEXT,
  normalizeWslBatchWorkflowPreset,
  type WslOverviewContext,
} from '@/lib/wsl/workflow';

// ============================================================================
// Saved Commands
// ============================================================================

export interface WslSavedCommand {
  id: string;
  name: string;
  command: string;
  user?: string;
  isPreset?: boolean;
}

// ============================================================================
// Distro Tags
// ============================================================================

const DEFAULT_AVAILABLE_TAGS = ['dev', 'test', 'prod', 'experiment'];

// ============================================================================
// Store
// ============================================================================

interface WslStoreState {
  // Saved commands
  savedCommands: WslSavedCommand[];
  addSavedCommand: (cmd: Omit<WslSavedCommand, 'id'>) => void;
  removeSavedCommand: (id: string) => void;
  updateSavedCommand: (id: string, updates: Partial<Omit<WslSavedCommand, 'id'>>) => void;

  // Distro tags
  distroTags: Record<string, string[]>;
  availableTags: string[];
  setDistroTags: (distro: string, tags: string[]) => void;
  addAvailableTag: (tag: string) => void;
  removeAvailableTag: (tag: string) => void;

  // Custom config profiles
  customProfiles: WslNetworkPreset[];
  addCustomProfile: (profile: WslNetworkPreset) => void;
  removeCustomProfile: (id: string) => void;
  updateCustomProfile: (id: string, updates: Partial<WslNetworkPreset>) => void;

  workflowPresets: WslBatchWorkflowPreset[];
  workflowSummaries: WslBatchWorkflowSummary[];
  addWorkflowPreset: (preset: Omit<WslBatchWorkflowPreset, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateWorkflowPreset: (
    id: string,
    updates: Partial<Omit<WslBatchWorkflowPreset, 'id' | 'createdAt'>>
  ) => void;
  removeWorkflowPreset: (id: string) => void;
  recordWorkflowSummary: (summary: WslBatchWorkflowSummary) => void;

  overviewContext: WslOverviewContext;
  setOverviewContext: (context: Partial<WslOverviewContext>) => void;
}

function createPersistedId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeWorkflowSummary(summary: WslBatchWorkflowSummary): WslBatchWorkflowSummary {
  return {
    ...summary,
    workflow: normalizeWslBatchWorkflowPreset(summary.workflow),
    stepResults: summary.stepResults ?? [],
    resumeFromStepIndex: summary.resumeFromStepIndex ?? null,
    resumeFromStepIndexByDistro: summary.resumeFromStepIndexByDistro ?? {},
  };
}

export const useWslStore = create<WslStoreState>()(
  persist(
    (set) => ({
      // Saved commands
      savedCommands: [],
      addSavedCommand: (cmd) =>
        set((state) => ({
          savedCommands: [
            ...state.savedCommands,
            { ...cmd, id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
          ],
        })),
      removeSavedCommand: (id) =>
        set((state) => ({
          savedCommands: state.savedCommands.filter((c) => c.id !== id),
        })),
      updateSavedCommand: (id, updates) =>
        set((state) => ({
          savedCommands: state.savedCommands.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      // Distro tags
      distroTags: {},
      availableTags: DEFAULT_AVAILABLE_TAGS,
      setDistroTags: (distro, tags) =>
        set((state) => ({
          distroTags: { ...state.distroTags, [distro]: tags },
        })),
      addAvailableTag: (tag) =>
        set((state) => ({
          availableTags: state.availableTags.includes(tag)
            ? state.availableTags
            : [...state.availableTags, tag],
        })),
      removeAvailableTag: (tag) =>
        set((state) => ({
          availableTags: state.availableTags.filter((t) => t !== tag),
          distroTags: Object.fromEntries(
            Object.entries(state.distroTags).map(([d, tags]) => [
              d,
              tags.filter((t) => t !== tag),
            ])
          ),
        })),

      // Custom config profiles
      customProfiles: [],
      addCustomProfile: (profile) =>
        set((state) => ({
          customProfiles: [...state.customProfiles, profile],
        })),
      removeCustomProfile: (id) =>
        set((state) => ({
          customProfiles: state.customProfiles.filter((p) => p.id !== id),
        })),
      updateCustomProfile: (id, updates) =>
        set((state) => ({
          customProfiles: state.customProfiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      workflowPresets: [],
      workflowSummaries: [],
      addWorkflowPreset: (preset) =>
        set((state) => {
          const timestamp = new Date().toISOString();
          const normalizedPreset = normalizeWslBatchWorkflowPreset({
            ...preset,
            id: createPersistedId('workflow'),
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          return {
            workflowPresets: [
              ...state.workflowPresets,
              normalizedPreset,
            ],
          };
        }),
      updateWorkflowPreset: (id, updates) =>
        set((state) => ({
          workflowPresets: state.workflowPresets.map((preset) =>
            preset.id === id
              ? normalizeWslBatchWorkflowPreset({
                  ...preset,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                })
              : preset
          ),
        })),
      removeWorkflowPreset: (id) =>
        set((state) => ({
          workflowPresets: state.workflowPresets.filter((preset) => preset.id !== id),
        })),
      recordWorkflowSummary: (summary) =>
        set((state) => ({
          workflowSummaries: [normalizeWorkflowSummary(summary), ...state.workflowSummaries].slice(0, 10),
        })),

      overviewContext: DEFAULT_WSL_OVERVIEW_CONTEXT,
      setOverviewContext: (context) =>
        set((state) => ({
          overviewContext: {
            tab: context.tab ?? state.overviewContext.tab,
            tag: context.tag ?? state.overviewContext.tag,
            origin: context.origin ?? state.overviewContext.origin,
          },
        })),
    }),
    {
      name: 'cognia-wsl-store',
      version: 3,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') {
          return persisted as WslStoreState;
        }

        const typed = persisted as Partial<WslStoreState>;

        const normalizedWorkflowPresets = (typed.workflowPresets ?? []).map((preset) =>
          normalizeWslBatchWorkflowPreset(preset)
        );
        const normalizedWorkflowSummaries = (typed.workflowSummaries ?? []).map((summary) =>
          normalizeWorkflowSummary(summary)
        );

        if (version < 2) {
          return {
            ...typed,
            workflowPresets: normalizedWorkflowPresets,
            workflowSummaries: normalizedWorkflowSummaries,
          } as WslStoreState;
        }

        if (version < 3) {
          return {
            ...typed,
            workflowPresets: normalizedWorkflowPresets,
            workflowSummaries: normalizedWorkflowSummaries,
          } as WslStoreState;
        }

        return {
          ...typed,
          workflowPresets: normalizedWorkflowPresets,
          workflowSummaries: normalizedWorkflowSummaries,
        } as WslStoreState;
      },
    }
  )
);

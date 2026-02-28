import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FeedbackCategory,
  FeedbackFormData,
  FeedbackErrorContext,
} from '@/types/feedback';

interface FeedbackDialogState {
  /** Whether the feedback dialog is open */
  dialogOpen: boolean;
  /** Pre-selected category when opening */
  preSelectedCategory: FeedbackCategory | null;
  /** Pre-filled error context (from error boundaries / crash recovery) */
  preFilledErrorContext: FeedbackErrorContext | null;
  /** Draft data persisted across sessions */
  draft: Partial<FeedbackFormData> | null;
}

interface FeedbackStoreActions {
  openDialog: (options?: {
    category?: FeedbackCategory;
    errorContext?: FeedbackErrorContext;
  }) => void;
  closeDialog: () => void;
  saveDraft: (data: Partial<FeedbackFormData>) => void;
  clearDraft: () => void;
}

type FeedbackStore = FeedbackDialogState & FeedbackStoreActions;

export const useFeedbackStore = create<FeedbackStore>()(
  persist(
    (set) => ({
      dialogOpen: false,
      preSelectedCategory: null,
      preFilledErrorContext: null,
      draft: null,

      openDialog: (options) =>
        set({
          dialogOpen: true,
          preSelectedCategory: options?.category ?? null,
          preFilledErrorContext: options?.errorContext ?? null,
        }),

      closeDialog: () =>
        set({
          dialogOpen: false,
          preSelectedCategory: null,
          preFilledErrorContext: null,
        }),

      saveDraft: (data) => set({ draft: data }),

      clearDraft: () => set({ draft: null }),
    }),
    {
      name: 'cognia-feedback',
      version: 1,
      partialize: (state) => ({
        draft: state.draft,
      }),
    },
  ),
);

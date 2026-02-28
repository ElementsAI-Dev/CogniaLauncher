import { useFeedbackStore } from './feedback';
import { act } from '@testing-library/react';

describe('feedback store', () => {
  beforeEach(() => {
    act(() => {
      useFeedbackStore.setState({
        dialogOpen: false,
        preSelectedCategory: null,
        preFilledErrorContext: null,
        draft: null,
      });
    });
  });

  it('has correct initial state', () => {
    const state = useFeedbackStore.getState();
    expect(state.dialogOpen).toBe(false);
    expect(state.preSelectedCategory).toBeNull();
    expect(state.preFilledErrorContext).toBeNull();
    expect(state.draft).toBeNull();
  });

  it('openDialog sets dialogOpen to true', () => {
    act(() => {
      useFeedbackStore.getState().openDialog();
    });
    expect(useFeedbackStore.getState().dialogOpen).toBe(true);
    expect(useFeedbackStore.getState().preSelectedCategory).toBeNull();
  });

  it('openDialog with category sets preSelectedCategory', () => {
    act(() => {
      useFeedbackStore.getState().openDialog({ category: 'bug' });
    });
    const state = useFeedbackStore.getState();
    expect(state.dialogOpen).toBe(true);
    expect(state.preSelectedCategory).toBe('bug');
  });

  it('openDialog with errorContext sets preFilledErrorContext', () => {
    const errorContext = {
      message: 'test error',
      stack: 'Error: test\n  at foo.ts:1',
      component: 'TestComponent',
    };
    act(() => {
      useFeedbackStore.getState().openDialog({ category: 'crash', errorContext });
    });
    const state = useFeedbackStore.getState();
    expect(state.dialogOpen).toBe(true);
    expect(state.preSelectedCategory).toBe('crash');
    expect(state.preFilledErrorContext).toEqual(errorContext);
  });

  it('closeDialog resets dialog state', () => {
    act(() => {
      useFeedbackStore.getState().openDialog({ category: 'feature' });
    });
    expect(useFeedbackStore.getState().dialogOpen).toBe(true);

    act(() => {
      useFeedbackStore.getState().closeDialog();
    });
    const state = useFeedbackStore.getState();
    expect(state.dialogOpen).toBe(false);
    expect(state.preSelectedCategory).toBeNull();
    expect(state.preFilledErrorContext).toBeNull();
  });

  it('saveDraft persists draft data', () => {
    const draft = {
      category: 'bug' as const,
      title: 'Test title',
      description: 'Test description',
      includeDiagnostics: true,
    };
    act(() => {
      useFeedbackStore.getState().saveDraft(draft);
    });
    expect(useFeedbackStore.getState().draft).toEqual(draft);
  });

  it('clearDraft removes draft', () => {
    act(() => {
      useFeedbackStore.getState().saveDraft({
        category: 'bug',
        title: 'Draft',
        description: '',
        includeDiagnostics: false,
      });
    });
    expect(useFeedbackStore.getState().draft).not.toBeNull();

    act(() => {
      useFeedbackStore.getState().clearDraft();
    });
    expect(useFeedbackStore.getState().draft).toBeNull();
  });

  it('closeDialog does not clear draft', () => {
    const draft = {
      category: 'feature' as const,
      title: 'My feature',
      description: 'Details',
      includeDiagnostics: false,
    };
    act(() => {
      useFeedbackStore.getState().saveDraft(draft);
      useFeedbackStore.getState().openDialog({ category: 'bug' });
    });
    act(() => {
      useFeedbackStore.getState().closeDialog();
    });
    expect(useFeedbackStore.getState().draft).toEqual(draft);
  });
});

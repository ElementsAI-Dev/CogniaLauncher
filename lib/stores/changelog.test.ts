import { useChangelogStore } from './changelog';

// Reset store between tests
beforeEach(() => {
  useChangelogStore.setState({
    lastSeenVersion: '',
    whatsNewOpen: false,
  });
});

describe('useChangelogStore', () => {
  it('has correct initial state', () => {
    const state = useChangelogStore.getState();
    expect(state.lastSeenVersion).toBe('');
    expect(state.whatsNewOpen).toBe(false);
  });

  it('setLastSeenVersion updates the version', () => {
    useChangelogStore.getState().setLastSeenVersion('1.0.0');
    expect(useChangelogStore.getState().lastSeenVersion).toBe('1.0.0');
  });

  it('setWhatsNewOpen toggles the dialog', () => {
    useChangelogStore.getState().setWhatsNewOpen(true);
    expect(useChangelogStore.getState().whatsNewOpen).toBe(true);

    useChangelogStore.getState().setWhatsNewOpen(false);
    expect(useChangelogStore.getState().whatsNewOpen).toBe(false);
  });

  it('dismissWhatsNew sets version and closes dialog', () => {
    useChangelogStore.getState().setWhatsNewOpen(true);
    useChangelogStore.getState().dismissWhatsNew('2.0.0');

    const state = useChangelogStore.getState();
    expect(state.lastSeenVersion).toBe('2.0.0');
    expect(state.whatsNewOpen).toBe(false);
  });

  it('dismissWhatsNew updates version from previous value', () => {
    useChangelogStore.getState().setLastSeenVersion('1.0.0');
    useChangelogStore.getState().dismissWhatsNew('1.1.0');
    expect(useChangelogStore.getState().lastSeenVersion).toBe('1.1.0');
  });
});

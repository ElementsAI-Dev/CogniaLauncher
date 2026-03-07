import { useWslStore } from './wsl';

describe('useWslStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useWslStore.setState({
      savedCommands: [],
      distroTags: {},
      availableTags: ['dev', 'test', 'prod', 'experiment'],
      customProfiles: [],
      overviewContext: { tab: 'installed', tag: null, origin: 'overview' },
    });
  });

  it('adds, updates, and removes saved commands', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.123456);

    useWslStore.getState().addSavedCommand({
      name: 'List files',
      command: 'ls -la',
      user: 'root',
    });
    const added = useWslStore.getState().savedCommands[0];
    expect(added.name).toBe('List files');
    expect(added.id.startsWith('cmd-1700000000000-')).toBe(true);

    useWslStore.getState().updateSavedCommand(added.id, { name: 'List all files' });
    expect(useWslStore.getState().savedCommands[0].name).toBe('List all files');

    useWslStore.getState().removeSavedCommand(added.id);
    expect(useWslStore.getState().savedCommands).toEqual([]);

    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it('manages distro tags and available tag catalog without duplicates', () => {
    useWslStore.getState().setDistroTags('Ubuntu', ['dev', 'prod']);
    expect(useWslStore.getState().distroTags.Ubuntu).toEqual(['dev', 'prod']);

    useWslStore.getState().addAvailableTag('qa');
    useWslStore.getState().addAvailableTag('qa');
    expect(useWslStore.getState().availableTags.filter((tag) => tag === 'qa')).toHaveLength(1);

    useWslStore.getState().removeAvailableTag('dev');
    const state = useWslStore.getState();
    expect(state.availableTags).not.toContain('dev');
    expect(state.distroTags.Ubuntu).toEqual(['prod']);
  });

  it('adds, updates, and removes custom network profiles', () => {
    const profile = {
      id: 'custom-1',
      labelKey: 'wsl.custom.label',
      descKey: 'wsl.custom.desc',
      settings: [{ section: 'wsl2' as const, key: 'memory', value: '6GB' }],
    };
    useWslStore.getState().addCustomProfile(profile);
    expect(useWslStore.getState().customProfiles).toHaveLength(1);

    useWslStore.getState().updateCustomProfile('custom-1', { descKey: 'wsl.custom.updated' });
    expect(useWslStore.getState().customProfiles[0].descKey).toBe('wsl.custom.updated');

    useWslStore.getState().removeCustomProfile('custom-1');
    expect(useWslStore.getState().customProfiles).toEqual([]);
  });

  it('stores WSL overview workflow context', () => {
    useWslStore.getState().setOverviewContext({
      tab: 'available',
      tag: 'dev',
      origin: 'sidebar',
    });

    expect(useWslStore.getState().overviewContext).toEqual({
      tab: 'available',
      tag: 'dev',
      origin: 'sidebar',
    });
  });
});

import { renderHook, act } from '@testing-library/react';
import { useRustup } from './use-rustup';

const mockRustupListComponents = jest.fn();
const mockRustupAddComponent = jest.fn();
const mockRustupRemoveComponent = jest.fn();
const mockRustupListTargets = jest.fn();
const mockRustupAddTarget = jest.fn();
const mockRustupRemoveTarget = jest.fn();
const mockRustupOverrideSet = jest.fn();
const mockRustupOverrideUnset = jest.fn();
const mockRustupOverrideList = jest.fn();
const mockRustupShow = jest.fn();
const mockRustupSelfUpdate = jest.fn();
const mockRustupUpdateAll = jest.fn();
const mockRustupRun = jest.fn();
const mockRustupWhich = jest.fn();
const mockRustupGetProfile = jest.fn();
const mockRustupSetProfile = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  rustupListComponents: (...args: unknown[]) => mockRustupListComponents(...args),
  rustupAddComponent: (...args: unknown[]) => mockRustupAddComponent(...args),
  rustupRemoveComponent: (...args: unknown[]) => mockRustupRemoveComponent(...args),
  rustupListTargets: (...args: unknown[]) => mockRustupListTargets(...args),
  rustupAddTarget: (...args: unknown[]) => mockRustupAddTarget(...args),
  rustupRemoveTarget: (...args: unknown[]) => mockRustupRemoveTarget(...args),
  rustupOverrideSet: (...args: unknown[]) => mockRustupOverrideSet(...args),
  rustupOverrideUnset: (...args: unknown[]) => mockRustupOverrideUnset(...args),
  rustupOverrideList: (...args: unknown[]) => mockRustupOverrideList(...args),
  rustupShow: (...args: unknown[]) => mockRustupShow(...args),
  rustupSelfUpdate: (...args: unknown[]) => mockRustupSelfUpdate(...args),
  rustupUpdateAll: (...args: unknown[]) => mockRustupUpdateAll(...args),
  rustupRun: (...args: unknown[]) => mockRustupRun(...args),
  rustupWhich: (...args: unknown[]) => mockRustupWhich(...args),
  rustupGetProfile: (...args: unknown[]) => mockRustupGetProfile(...args),
  rustupSetProfile: (...args: unknown[]) => mockRustupSetProfile(...args),
}));

describe('useRustup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useRustup());

    expect(result.current.components).toEqual([]);
    expect(result.current.targets).toEqual([]);
    expect(result.current.overrides).toEqual([]);
    expect(result.current.showInfo).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── Component management ──

  it('should list components', async () => {
    const comps = [
      { name: 'rustfmt', installed: true },
      { name: 'clippy', installed: true },
    ];
    mockRustupListComponents.mockResolvedValue(comps);

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.listComponents('stable');
    });

    expect(res).toEqual(comps);
    expect(result.current.components).toEqual(comps);
    expect(mockRustupListComponents).toHaveBeenCalledWith('stable');
  });

  it('should add component', async () => {
    mockRustupAddComponent.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.addComponent('clippy', 'nightly');
    });

    expect(mockRustupAddComponent).toHaveBeenCalledWith('clippy', 'nightly');
  });

  it('should remove component', async () => {
    mockRustupRemoveComponent.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.removeComponent('clippy');
    });

    expect(mockRustupRemoveComponent).toHaveBeenCalledWith('clippy', undefined);
  });

  // ── Target management ──

  it('should list targets', async () => {
    const targets = [
      { name: 'x86_64-unknown-linux-gnu', installed: true },
      { name: 'wasm32-unknown-unknown', installed: false },
    ];
    mockRustupListTargets.mockResolvedValue(targets);

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.listTargets();
    });

    expect(res).toEqual(targets);
    expect(result.current.targets).toEqual(targets);
  });

  it('should add target', async () => {
    mockRustupAddTarget.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.addTarget('wasm32-unknown-unknown', 'stable');
    });

    expect(mockRustupAddTarget).toHaveBeenCalledWith('wasm32-unknown-unknown', 'stable');
  });

  it('should remove target', async () => {
    mockRustupRemoveTarget.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.removeTarget('wasm32-unknown-unknown');
    });

    expect(mockRustupRemoveTarget).toHaveBeenCalledWith('wasm32-unknown-unknown', undefined);
  });

  // ── Override management ──

  it('should set override', async () => {
    mockRustupOverrideSet.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.overrideSet('nightly', '/project');
    });

    expect(mockRustupOverrideSet).toHaveBeenCalledWith('nightly', '/project');
  });

  it('should unset override', async () => {
    mockRustupOverrideUnset.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.overrideUnset('/project');
    });

    expect(mockRustupOverrideUnset).toHaveBeenCalledWith('/project');
  });

  it('should list overrides', async () => {
    const overrides = [{ path: '/project', toolchain: 'nightly' }];
    mockRustupOverrideList.mockResolvedValue(overrides);

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.overrideList();
    });

    expect(res).toEqual(overrides);
    expect(result.current.overrides).toEqual(overrides);
  });

  // ── Info & updates ──

  it('should show info', async () => {
    const info = { activeToolchain: 'stable', rustcVersion: '1.75.0' };
    mockRustupShow.mockResolvedValue(info);

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.show();
    });

    expect(res).toEqual(info);
    expect(result.current.showInfo).toEqual(info);
  });

  it('should self update', async () => {
    mockRustupSelfUpdate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.selfUpdate();
    });

    expect(mockRustupSelfUpdate).toHaveBeenCalled();
  });

  it('should update all', async () => {
    mockRustupUpdateAll.mockResolvedValue('Updated stable, nightly');

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.updateAll();
    });

    expect(res).toBe('Updated stable, nightly');
  });

  // ── Run & which ──

  it('should run command', async () => {
    mockRustupRun.mockResolvedValue('rustc 1.75.0');

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.run('stable', 'rustc', ['--version']);
    });

    expect(res).toBe('rustc 1.75.0');
    expect(mockRustupRun).toHaveBeenCalledWith('stable', 'rustc', ['--version']);
  });

  it('should which binary', async () => {
    mockRustupWhich.mockResolvedValue('/home/.rustup/toolchains/stable/bin/cargo');

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.which('cargo');
    });

    expect(res).toBe('/home/.rustup/toolchains/stable/bin/cargo');
  });

  // ── Profile ──

  it('should get profile', async () => {
    mockRustupGetProfile.mockResolvedValue('default');

    const { result } = renderHook(() => useRustup());

    let res;
    await act(async () => {
      res = await result.current.getProfile();
    });

    expect(res).toBe('default');
    expect(result.current.profile).toBe('default');
  });

  it('should set profile', async () => {
    mockRustupSetProfile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.setProfile('minimal');
    });

    expect(mockRustupSetProfile).toHaveBeenCalledWith('minimal');
    expect(result.current.profile).toBe('minimal');
  });

  // ── Error handling ──

  it('should set error on failure and re-throw', async () => {
    mockRustupListComponents.mockRejectedValue(new Error('Rustup not found'));

    const { result } = renderHook(() => useRustup());

    let caughtMsg = '';
    await act(async () => {
      try {
        await result.current.listComponents();
      } catch (e) {
        caughtMsg = e instanceof Error ? e.message : String(e);
      }
    });

    expect(caughtMsg).toBe('Rustup not found');
    expect(result.current.error).toBe('Rustup not found');
    expect(result.current.loading).toBe(false);
  });

  // ── refreshAll ──

  it('should refresh all state', async () => {
    const comps = [{ name: 'rustfmt', installed: true }];
    const targets = [{ name: 'x86_64-unknown-linux-gnu', installed: true }];
    const overrides = [{ path: '/p', toolchain: 'stable' }];
    const info = { activeToolchain: 'stable' };
    const profile = 'default';

    mockRustupListComponents.mockResolvedValue(comps);
    mockRustupListTargets.mockResolvedValue(targets);
    mockRustupOverrideList.mockResolvedValue(overrides);
    mockRustupShow.mockResolvedValue(info);
    mockRustupGetProfile.mockResolvedValue(profile);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.components).toEqual(comps);
    expect(result.current.targets).toEqual(targets);
    expect(result.current.overrides).toEqual(overrides);
    expect(result.current.showInfo).toEqual(info);
    expect(result.current.profile).toBe(profile);
    expect(result.current.loading).toBe(false);
  });

  it('should handle partial failures in refreshAll', async () => {
    mockRustupListComponents.mockRejectedValue(new Error('fail'));
    mockRustupListTargets.mockResolvedValue([]);
    mockRustupOverrideList.mockResolvedValue([]);
    mockRustupShow.mockResolvedValue(null);
    mockRustupGetProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.refreshAll();
    });

    // Should still have loaded the successful ones
    expect(result.current.targets).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should skip refreshAll when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useRustup());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(mockRustupListComponents).not.toHaveBeenCalled();
  });
});

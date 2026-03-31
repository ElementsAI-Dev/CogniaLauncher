import { act } from "@testing-library/react";
import { useTerminalStore } from "@/lib/stores/terminal";
import type { TerminalProfile } from "@/types/tauri";

const mockTerminalListProfiles = jest.fn();
const mockTerminalDetectShells = jest.fn();
const mockTerminalGetDefaultProfile = jest.fn();

jest.mock("@/lib/platform", () => ({
  isTauri: () => true,
}));

jest.mock("@/lib/tauri", () => ({
  terminalListProfiles: (...args: unknown[]) => mockTerminalListProfiles(...args),
  terminalDetectShells: (...args: unknown[]) => mockTerminalDetectShells(...args),
  terminalGetDefaultProfile: (...args: unknown[]) => mockTerminalGetDefaultProfile(...args),
}));

function makeProfile(overrides: Partial<TerminalProfile> = {}): TerminalProfile {
  return {
    id: "profile-1",
    name: "Default Profile",
    shellId: "pwsh",
    args: [],
    envVars: {},
    cwd: null,
    startupCommand: null,
    envType: null,
    envVersion: null,
    color: null,
    isDefault: false,
    createdAt: "2026-03-28T00:00:00.000Z",
    updatedAt: "2026-03-28T00:00:00.000Z",
    ...overrides,
  };
}

function resetStore() {
  useTerminalStore.setState({
    profiles: [],
    shells: [],
    defaultProfileId: null,
    recentlyLaunchedIds: [],
    loading: false,
    error: null,
  });
}

describe("useTerminalStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockTerminalListProfiles.mockResolvedValue([]);
    mockTerminalDetectShells.mockResolvedValue([]);
    mockTerminalGetDefaultProfile.mockResolvedValue(null);
  });

  it("hydrates profiles, shells, and default profile from tauri", async () => {
    const defaultProfile = makeProfile({ id: "profile-default", isDefault: true });
    mockTerminalListProfiles.mockResolvedValue([
      defaultProfile,
      makeProfile({ id: "profile-2", name: "Node Shell" }),
    ]);
    mockTerminalDetectShells.mockResolvedValue([
      {
        id: "pwsh",
        name: "PowerShell",
        shellType: "powershell",
        executablePath: "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
        configFiles: [],
        isDefault: true,
      },
    ]);
    mockTerminalGetDefaultProfile.mockResolvedValue(defaultProfile);

    await act(async () => {
      await useTerminalStore.getState().hydrate();
    });

    const state = useTerminalStore.getState();
    expect(mockTerminalListProfiles).toHaveBeenCalledTimes(1);
    expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1);
    expect(mockTerminalGetDefaultProfile).toHaveBeenCalledTimes(1);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.profiles).toHaveLength(2);
    expect(state.shells).toHaveLength(1);
    expect(state.defaultProfileId).toBe("profile-default");
  });

  it("supports profile CRUD write-through helpers", () => {
    const created = makeProfile({ id: "created", name: "Created", isDefault: false });
    const updated = makeProfile({ id: "created", name: "Updated", isDefault: true });
    const secondary = makeProfile({ id: "secondary", name: "Secondary" });

    act(() => {
      const store = useTerminalStore.getState();
      store.upsertProfile(created);
      store.upsertProfile(secondary);
      store.upsertProfile(updated);
      store.removeProfile("secondary");
    });

    const state = useTerminalStore.getState();
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0]).toEqual(updated);
    expect(state.defaultProfileId).toBe("created");

    act(() => {
      useTerminalStore.getState().setDefaultProfileId("created");
    });

    expect(useTerminalStore.getState().profiles[0].isDefault).toBe(true);
  });

  it("tracks recently launched profiles uniquely and caps the list at three", () => {
    act(() => {
      const store = useTerminalStore.getState();
      store.markProfileLaunched("profile-1");
      store.markProfileLaunched("profile-2");
      store.markProfileLaunched("profile-3");
      store.markProfileLaunched("profile-2");
      store.markProfileLaunched("profile-4");
    });

    expect(useTerminalStore.getState().recentlyLaunchedIds).toEqual([
      "profile-4",
      "profile-2",
      "profile-3",
    ]);
  });
});

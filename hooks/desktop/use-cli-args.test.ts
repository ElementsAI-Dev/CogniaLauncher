import { renderHook, waitFor } from "@testing-library/react";
import { useCliArgs } from "@/hooks/desktop/use-cli-args";

// Mock isTauri - default to false (web mode)
const mockIsTauri = jest.fn(() => false);
jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
}));

// Mock @tauri-apps/plugin-cli
const mockGetMatches = jest.fn();
jest.mock("@tauri-apps/plugin-cli", () => ({
  getMatches: () => mockGetMatches(),
}));

describe("useCliArgs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it("should return null initially", () => {
    const { result } = renderHook(() => useCliArgs());
    expect(result.current).toBeNull();
  });

  it("should return null in web mode (non-Tauri)", async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useCliArgs());
    // Wait a tick for effect to run
    await waitFor(() => {
      expect(result.current).toBeNull();
    });
    expect(mockGetMatches).not.toHaveBeenCalled();
  });

  it("should parse CLI matches in Tauri mode with all flags false", async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetMatches.mockResolvedValue({
      args: {
        verbose: { value: false, occurrences: 0 },
        quiet: { value: false, occurrences: 0 },
        json: { value: false, occurrences: 0 },
        minimized: { value: false, occurrences: 0 },
      },
      subcommand: null,
    });

    const { result } = renderHook(() => useCliArgs());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toEqual({
      verbose: false,
      quiet: false,
      json: false,
      minimized: false,
      subcommand: null,
    });
  });

  it("should parse CLI matches with flags enabled", async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetMatches.mockResolvedValue({
      args: {
        verbose: { value: true, occurrences: 1 },
        quiet: { value: false, occurrences: 0 },
        json: { value: true, occurrences: 1 },
        minimized: { value: true, occurrences: 1 },
      },
      subcommand: null,
    });

    const { result } = renderHook(() => useCliArgs());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toEqual({
      verbose: true,
      quiet: false,
      json: true,
      minimized: true,
      subcommand: null,
    });
  });

  it("should parse subcommand name", async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetMatches.mockResolvedValue({
      args: {
        verbose: { value: false, occurrences: 0 },
        quiet: { value: false, occurrences: 0 },
        json: { value: false, occurrences: 0 },
        minimized: { value: false, occurrences: 0 },
      },
      subcommand: {
        name: "search",
        matches: { args: {} },
      },
    });

    const { result } = renderHook(() => useCliArgs());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.subcommand).toBe("search");
  });

  it("should handle missing arg entries gracefully", async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetMatches.mockResolvedValue({
      args: {},
      subcommand: null,
    });

    const { result } = renderHook(() => useCliArgs());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toEqual({
      verbose: false,
      quiet: false,
      json: false,
      minimized: false,
      subcommand: null,
    });
  });

  it("should handle getMatches rejection gracefully", async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetMatches.mockRejectedValue(new Error("CLI not available"));

    const { result } = renderHook(() => useCliArgs());
    // Should stay null on error (caught by .catch)
    await waitFor(
      () => {
        // Wait for the effect to have run (give it time)
        expect(mockGetMatches).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
    expect(result.current).toBeNull();
  });

  it("should handle undefined subcommand name", async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetMatches.mockResolvedValue({
      args: {
        verbose: { value: false, occurrences: 0 },
        quiet: { value: false, occurrences: 0 },
        json: { value: false, occurrences: 0 },
        minimized: { value: false, occurrences: 0 },
      },
      subcommand: undefined,
    });

    const { result } = renderHook(() => useCliArgs());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.subcommand).toBeNull();
  });

  it("should handle non-boolean arg values as false", async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetMatches.mockResolvedValue({
      args: {
        verbose: { value: "yes", occurrences: 1 },
        quiet: { value: 1, occurrences: 1 },
        json: { value: null, occurrences: 0 },
        minimized: { value: undefined, occurrences: 0 },
      },
      subcommand: null,
    });

    const { result } = renderHook(() => useCliArgs());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toEqual({
      verbose: false,
      quiet: false,
      json: false,
      minimized: false,
      subcommand: null,
    });
  });
});

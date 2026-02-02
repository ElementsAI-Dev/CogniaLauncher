import { renderHook, waitFor, act } from "@testing-library/react";
import { useAboutData } from "../use-about-data";

// Mock the Tauri API
const mockSelfCheckUpdate = jest.fn();
const mockSelfUpdate = jest.fn();
const mockGetPlatformInfo = jest.fn();
const mockGetCogniaDir = jest.fn();

jest.mock("@/lib/tauri", () => ({
  selfCheckUpdate: () => mockSelfCheckUpdate(),
  selfUpdate: () => mockSelfUpdate(),
  getPlatformInfo: () => mockGetPlatformInfo(),
  getCogniaDir: () => mockGetCogniaDir(),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("useAboutData hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelfCheckUpdate.mockResolvedValue({
      current_version: "0.1.0",
      latest_version: "0.1.0",
      update_available: false,
      release_notes: null,
    });
    mockGetPlatformInfo.mockResolvedValue({ os: "Windows", arch: "x64" });
    mockGetCogniaDir.mockResolvedValue("C:\\Users\\Test\\.cognia");
  });

  describe("initialization", () => {
    it("should fetch update info on mount", async () => {
      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSelfCheckUpdate).toHaveBeenCalledTimes(1);
      expect(result.current.updateInfo).toEqual({
        current_version: "0.1.0",
        latest_version: "0.1.0",
        update_available: false,
        release_notes: null,
      });
    });

    it("should fetch system info on mount", async () => {
      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.systemLoading).toBe(false);
      });

      expect(mockGetPlatformInfo).toHaveBeenCalledTimes(1);
      expect(mockGetCogniaDir).toHaveBeenCalledTimes(1);
      expect(result.current.systemInfo).toEqual({
        os: "Windows",
        arch: "x64",
        homeDir: "C:\\Users\\Test\\.cognia",
        locale: "en-US",
      });
    });

    it("should set locale based on input parameter", async () => {
      const { result } = renderHook(() => useAboutData("zh"));

      await waitFor(() => {
        expect(result.current.systemLoading).toBe(false);
      });

      expect(result.current.systemInfo?.locale).toBe("zh-CN");
    });
  });

  describe("error handling", () => {
    it("should handle update check errors", async () => {
      mockSelfCheckUpdate.mockRejectedValue(new Error("Some error"));

      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Hook categorizes errors - generic errors become "update_check_failed"
      expect(result.current.error).toBe("update_check_failed");
    });

    it("should categorize network errors", async () => {
      mockSelfCheckUpdate.mockRejectedValue(new Error("Failed to fetch"));

      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("network_error");
    });

    it("should clear error when clearError is called", async () => {
      mockSelfCheckUpdate.mockRejectedValue(new Error("Some error"));

      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.error).toBe("update_check_failed");
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it("should handle system info errors gracefully", async () => {
      mockGetPlatformInfo.mockRejectedValue(new Error("Failed to get platform"));
      mockGetCogniaDir.mockRejectedValue(new Error("Failed to get dir"));

      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.systemLoading).toBe(false);
      });

      // Should fall back to default values
      expect(result.current.systemInfo).toEqual({
        os: "Unknown",
        arch: "Unknown",
        homeDir: "~/.cognia",
        locale: "en-US",
      });
    });
  });

  describe("checkForUpdate", () => {
    it("should refetch update info when called", async () => {
      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Update mock to return different data
      mockSelfCheckUpdate.mockResolvedValue({
        current_version: "0.1.0",
        latest_version: "0.2.0",
        update_available: true,
        release_notes: "New features",
      });

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(mockSelfCheckUpdate).toHaveBeenCalledTimes(2);
      expect(result.current.updateInfo?.update_available).toBe(true);
    });

    it("should set loading state during check", async () => {
      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start the check but don't await
      let checkPromise: Promise<void>;
      act(() => {
        checkPromise = result.current.checkForUpdate();
      });

      // Loading should be true during the check
      expect(result.current.loading).toBe(true);

      await act(async () => {
        await checkPromise;
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe("handleUpdate", () => {
    it("should call selfUpdate and show success toast", async () => {
      mockSelfUpdate.mockResolvedValue(undefined);
      const mockT = jest.fn().mockReturnValue("Update started!");

      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleUpdate(mockT);
      });

      expect(mockSelfUpdate).toHaveBeenCalledTimes(1);
    });

    it("should set updating state during update", async () => {
      mockSelfUpdate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const mockT = jest.fn().mockReturnValue("Update started!");

      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let updatePromise: Promise<void>;
      act(() => {
        updatePromise = result.current.handleUpdate(mockT);
      });

      expect(result.current.updating).toBe(true);

      await act(async () => {
        await updatePromise;
      });

      expect(result.current.updating).toBe(false);
    });

    it("should show error toast on update failure", async () => {
      const sonner = jest.requireMock<{ toast: { success: jest.Mock; error: jest.Mock } }>("sonner");
      mockSelfUpdate.mockRejectedValue(new Error("Update failed"));
      const mockT = jest.fn().mockReturnValue("Error");

      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleUpdate(mockT);
      });

      expect(sonner.toast.error).toHaveBeenCalled();
    });
  });

  describe("updateProgress", () => {
    it("should start with zero progress", async () => {
      const { result } = renderHook(() => useAboutData("en"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Progress starts at 0, not null
      expect(result.current.updateProgress).toBe(0);
    });
  });
});

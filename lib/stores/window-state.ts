import { create } from "zustand";

interface WindowStateStore {
  isMaximized: boolean;
  isFullscreen: boolean;
  isDesktopMode: boolean;
  isFocused: boolean;
  isWindows: boolean;
  setMaximized: (value: boolean) => void;
  setFullscreen: (value: boolean) => void;
  setDesktopMode: (value: boolean) => void;
  setFocused: (value: boolean) => void;
  setWindows: (value: boolean) => void;
}

export const useWindowStateStore = create<WindowStateStore>((set) => ({
  isMaximized: false,
  isFullscreen: false,
  isDesktopMode: false,
  isFocused: true,
  isWindows: false,
  setMaximized: (value) => set({ isMaximized: value }),
  setFullscreen: (value) => set({ isFullscreen: value }),
  setDesktopMode: (value) => set({ isDesktopMode: value }),
  setFocused: (value) => set({ isFocused: value }),
  setWindows: (value) => set({ isWindows: value }),
}));

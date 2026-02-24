import { create } from "zustand";

interface WindowStateStore {
  isMaximized: boolean;
  isFullscreen: boolean;
  isFocused: boolean;
  titlebarHeight: string;
  setMaximized: (value: boolean) => void;
  setFullscreen: (value: boolean) => void;
  setFocused: (value: boolean) => void;
  setTitlebarHeight: (value: string) => void;
}

export const useWindowStateStore = create<WindowStateStore>((set) => ({
  isMaximized: false,
  isFullscreen: false,
  isFocused: true,
  titlebarHeight: "2rem",
  setMaximized: (value) => set({ isMaximized: value }),
  setFullscreen: (value) => set({ isFullscreen: value }),
  setFocused: (value) => set({ isFocused: value }),
  setTitlebarHeight: (value) => set({ titlebarHeight: value }),
}));

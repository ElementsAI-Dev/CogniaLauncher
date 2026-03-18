"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFeedbackStore } from "@/lib/stores/feedback";
import { useLogStore } from "@/lib/stores/log";
import {
  executeDesktopAction,
  type DesktopActionId,
} from "@/lib/desktop-actions";
import { isTauri } from "@/lib/platform";

interface UseDesktopActionExecutorOptions {
  openCommandPalette?: () => void;
  openQuickSearch?: () => void;
  toggleWindow?: () => Promise<void>;
}

async function ensureDesktopWindowVisible(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const windowHandle = getCurrentWindow();
  const visible = await windowHandle.isVisible();
  if (!visible) {
    await windowHandle.show();
  }
  await windowHandle.setFocus();
}

export function useDesktopActionExecutor(
  options: UseDesktopActionExecutorOptions = {},
) {
  const router = useRouter();
  const { toggleDrawer } = useLogStore();
  const { openDialog } = useFeedbackStore();

  return useCallback(
    async (actionId: DesktopActionId) =>
      executeDesktopAction(actionId, {
        navigate: (path) => router.push(path),
        ensureWindowVisible: ensureDesktopWindowVisible,
        toggleLogs: toggleDrawer,
        openCommandPalette: options.openCommandPalette,
        openQuickSearch: options.openQuickSearch,
        openFeedback: ({ category }) => openDialog({ category }),
        toggleWindow: options.toggleWindow,
      }),
    [
      openDialog,
      options.openCommandPalette,
      options.openQuickSearch,
      options.toggleWindow,
      router,
      toggleDrawer,
    ],
  );
}

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFeedbackStore } from "@/lib/stores/feedback";
import { useLogStore } from "@/lib/stores/log";
import { useWsl } from "@/hooks/wsl/use-wsl";
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
  const {
    status,
    distros,
    launch,
    shutdown,
    openInTerminal,
  } = useWsl();

  const defaultWslDistro =
    status?.defaultDistribution
    ?? distros.find((distro) => distro.isDefault)?.name
    ?? null;

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
        wslLaunchDefault: async () => {
          if (!defaultWslDistro) return false;
          await launch(defaultWslDistro);
          return true;
        },
        wslShutdownAll: async () => {
          await shutdown();
          return true;
        },
        wslOpenTerminal: async () => {
          if (!defaultWslDistro) return false;
          await openInTerminal(defaultWslDistro);
          return true;
        },
      }),
    [
      defaultWslDistro,
      launch,
      openDialog,
      openInTerminal,
      options.openCommandPalette,
      options.openQuickSearch,
      options.toggleWindow,
      router,
      shutdown,
      toggleDrawer,
    ],
  );
}

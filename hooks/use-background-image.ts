'use client';

import { useCallback, useRef, useSyncExternalStore } from "react";
import { useAppearanceStore } from "@/lib/stores/appearance";
import {
  compressImage,
  setBackgroundImageData,
  getBackgroundImage,
  notifyBackgroundChange,
  BG_CHANGE_EVENT,
} from "@/lib/theme/background";
import { isTauri } from "@/lib/tauri";
import { toast } from "sonner";

function subscribeBgChange(cb: () => void) {
  window.addEventListener(BG_CHANGE_EVENT, cb);
  return () => window.removeEventListener(BG_CHANGE_EVENT, cb);
}

function snapshotHasImage() {
  return getBackgroundImage() !== null;
}

function serverSnapshotHasImage() {
  return false;
}

export interface UseBackgroundImageReturn {
  hasImage: boolean;
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleSelectImage: () => Promise<void>;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClear: () => void;
}

/**
 * Hook for background image selection, compression, and management
 * Extracted from components/settings/background-settings.tsx
 */
export function useBackgroundImage(
  t: (key: string) => string,
): UseBackgroundImageReturn {
  const {
    backgroundEnabled,
    setBackgroundEnabled,
    clearBackground,
  } = useAppearanceStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasImage = useSyncExternalStore(subscribeBgChange, snapshotHasImage, serverSnapshotHasImage);
  const previewUrl = hasImage ? getBackgroundImage() : null;

  const handleImageSelected = useCallback(
    async (blob: Blob) => {
      try {
        const dataUrl = await compressImage(blob);
        setBackgroundImageData(dataUrl);
        notifyBackgroundChange();
        if (!backgroundEnabled) {
          setBackgroundEnabled(true);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          toast.error(t("settings.backgroundTooLarge"));
        } else {
          toast.error(String(e));
        }
      }
    },
    [backgroundEnabled, setBackgroundEnabled, t],
  );

  const handleSelectImage = useCallback(async () => {
    if (isTauri()) {
      try {
        const dialogModule = await import("@tauri-apps/plugin-dialog").catch(
          () => null,
        );
        if (!dialogModule?.open) {
          fileInputRef.current?.click();
          return;
        }

        const selected = await dialogModule.open({
          multiple: false,
          filters: [
            {
              name: "Images",
              extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
            },
          ],
        });

        if (!selected || typeof selected !== "string") return;

        const fsModule = await import("@tauri-apps/plugin-fs").catch(
          () => null,
        );
        if (!fsModule?.readFile) {
          fileInputRef.current?.click();
          return;
        }

        const data = await fsModule.readFile(selected);
        const blob = new Blob([data]);
        await handleImageSelected(blob);
      } catch {
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [handleImageSelected]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImageSelected(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleImageSelected],
  );

  const handleClear = useCallback(() => {
    clearBackground();
    notifyBackgroundChange();
  }, [clearBackground]);

  return {
    hasImage,
    previewUrl,
    fileInputRef,
    handleSelectImage,
    handleFileInputChange,
    handleClear,
  };
}

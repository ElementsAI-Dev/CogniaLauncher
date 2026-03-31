'use client';

import { useCallback, useRef, useSyncExternalStore } from "react";
import { useAppearanceStore } from "@/lib/stores/appearance";
import {
  compressImage,
  setBackgroundImageData,
  getBackgroundImage,
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
  handleDragOver: (e: React.DragEvent<HTMLElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLElement>) => void;
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

  const processImageBlob = useCallback(
    async (blob: Blob): Promise<void> => {
      if (blob.size <= 0) {
        toast.error(t("settings.backgroundInvalidImage"));
        return;
      }
      if (blob.type && !blob.type.startsWith("image/")) {
        toast.error(t("settings.backgroundUnsupportedFormat"));
        return;
      }

      try {
        const dataUrl = await compressImage(blob);
        if (!dataUrl || !dataUrl.startsWith("data:image/")) {
          toast.error(t("settings.backgroundInvalidImage"));
          return;
        }
        setBackgroundImageData(dataUrl);
        if (!backgroundEnabled) {
          setBackgroundEnabled(true);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          toast.error(t("settings.backgroundTooLarge"));
          return;
        }
        toast.error(t("settings.backgroundProcessFailed"));
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
        await processImageBlob(blob);
      } catch {
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [processImageBlob]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void processImageBlob(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processImageBlob],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) {
        void processImageBlob(file);
      }
    },
    [processImageBlob],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) {
        toast.error(t("settings.backgroundInvalidImage"));
        return;
      }
      e.preventDefault();
      void processImageBlob(file);
    },
    [processImageBlob, t],
  );

  const handleClear = useCallback(() => {
    clearBackground();
  }, [clearBackground]);

  return {
    hasImage,
    previewUrl,
    fileInputRef,
    handleSelectImage,
    handleFileInputChange,
    handleDragOver,
    handleDrop,
    handlePaste,
    handleClear,
  };
}

"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { useAppearanceStore } from "@/lib/stores/appearance";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SwitchSettingItem, SliderSettingItem, SelectSettingItem } from "./setting-item";
import {
  compressImage,
  setBackgroundImageData,
  getBackgroundImage,
  notifyBackgroundChange,
  BG_CHANGE_EVENT,
} from "@/lib/theme/background";
import { isTauri } from "@/lib/tauri";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BackgroundFit } from "@/lib/stores/appearance";

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

interface BackgroundSettingsProps {
  t: (key: string) => string;
}

export function BackgroundSettings({ t }: BackgroundSettingsProps) {
  const {
    backgroundEnabled,
    setBackgroundEnabled,
    backgroundOpacity,
    setBackgroundOpacity,
    backgroundBlur,
    setBackgroundBlur,
    backgroundFit,
    setBackgroundFit,
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

  const disabled = !backgroundEnabled;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">
          {t("settings.backgroundImage")}
        </Label>
        <p className="text-sm text-muted-foreground">
          {t("settings.backgroundImageDesc")}
        </p>
      </div>

      <SwitchSettingItem
        id="background-enabled"
        label={t("settings.backgroundEnabled")}
        description={t("settings.backgroundEnabledDesc")}
        checked={backgroundEnabled}
        onCheckedChange={setBackgroundEnabled}
      />

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          aria-label={t("settings.backgroundSelect")}
        />
        {previewUrl && (
          <div
            className="h-16 w-16 shrink-0 rounded-md border bg-muted overflow-hidden"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectImage}
            disabled={disabled}
          >
            <ImagePlus className="h-4 w-4 mr-2" />
            {t("settings.backgroundSelect")}
          </Button>
          {hasImage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("settings.backgroundClear")}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <SliderSettingItem
        id="background-opacity"
        label={t("settings.backgroundOpacity")}
        description={t("settings.backgroundOpacityDesc")}
        value={backgroundOpacity}
        onValueChange={setBackgroundOpacity}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        unit="%"
      />

      <SliderSettingItem
        id="background-blur"
        label={t("settings.backgroundBlur")}
        description={t("settings.backgroundBlurDesc")}
        value={backgroundBlur}
        onValueChange={setBackgroundBlur}
        min={0}
        max={20}
        step={1}
        disabled={disabled}
        unit="px"
      />

      <SelectSettingItem
        id="background-fit"
        label={t("settings.backgroundFit")}
        description={t("settings.backgroundFitDesc")}
        value={backgroundFit}
        onValueChange={(v) => setBackgroundFit(v as BackgroundFit)}
        options={[
          { value: "cover", label: t("settings.backgroundFitCover") },
          { value: "contain", label: t("settings.backgroundFitContain") },
          { value: "fill", label: t("settings.backgroundFitFill") },
          { value: "tile", label: t("settings.backgroundFitTile") },
        ]}
        placeholder={t("settings.backgroundFit")}
        disabled={disabled}
        triggerClassName="w-40"
      />
    </div>
  );
}

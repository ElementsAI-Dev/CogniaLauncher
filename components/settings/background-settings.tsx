"use client";

import { useAppearanceStore } from "@/lib/stores/appearance";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SwitchSettingItem, SliderSettingItem, SelectSettingItem } from "./setting-item";
import { AlertCircle, ImagePlus, Trash2 } from "lucide-react";
import { useBackgroundImage } from "@/hooks/use-background-image";
import type { BackgroundFit } from "@/lib/stores/appearance";

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
  } = useAppearanceStore();

  const {
    hasImage,
    previewUrl,
    fileInputRef,
    handleSelectImage,
    handleFileInputChange,
    handleClear,
  } = useBackgroundImage(t);

  const paramsDisabled = !backgroundEnabled || !hasImage;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
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

      {backgroundEnabled && !hasImage ? (
        <Alert>
          <AlertCircle />
          <AlertDescription>
            {t("settings.backgroundMissingImage")}
          </AlertDescription>
        </Alert>
      ) : null}

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
        disabled={paramsDisabled}
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
        disabled={paramsDisabled}
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
        disabled={paramsDisabled}
        triggerClassName="w-40"
      />
    </div>
  );
}

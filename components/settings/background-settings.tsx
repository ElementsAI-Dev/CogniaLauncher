"use client";

import { useAppearanceStore } from "@/lib/stores/appearance";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SwitchSettingItem, SliderSettingItem, SelectSettingItem } from "./setting-item";
import { AlertCircle, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { useBackgroundImage } from "@/hooks/settings/use-background-image";
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
    backgroundScale,
    setBackgroundScale,
    backgroundPositionX,
    setBackgroundPositionX,
    backgroundPositionY,
    setBackgroundPositionY,
    resetBackgroundTuning,
  } = useAppearanceStore();

  const {
    hasImage,
    previewUrl,
    fileInputRef,
    handleSelectImage,
    handleFileInputChange,
    handleDragOver,
    handleDrop,
    handlePaste,
    handleClear,
  } = useBackgroundImage(t);

  const paramsDisabled = !backgroundEnabled || !hasImage;
  const scaleDisabled = paramsDisabled || backgroundFit === "tile";

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

      <Card className="gap-4 py-4">
        <CardHeader className="gap-2 px-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {t("settings.backgroundPreviewTitle")}
              </CardTitle>
              <CardDescription>
                {t("settings.backgroundDropPasteHint")}
              </CardDescription>
            </div>
            <Badge variant={hasImage ? "secondary" : "outline"}>
              {hasImage
                ? t("settings.backgroundPreviewReady")
                : t("settings.backgroundPreviewEmpty")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          {backgroundEnabled && !hasImage ? (
            <Alert>
              <AlertCircle />
              <AlertDescription>
                {t("settings.backgroundMissingImage")}
              </AlertDescription>
            </Alert>
          ) : null}

          <div
            className="flex items-center gap-3 rounded-md border border-dashed border-border p-3"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onPaste={handlePaste}
            tabIndex={0}
            role="group"
            aria-label={t("settings.backgroundDropPasteHint")}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
              aria-label={t("settings.backgroundSelect")}
            />
            {previewUrl ? (
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
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted text-center text-xs text-muted-foreground">
                {t("settings.backgroundPreviewEmpty")}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={resetBackgroundTuning}
                disabled={!hasImage && !backgroundEnabled}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("settings.backgroundResetTuning")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <SliderSettingItem
        id="background-scale"
        label={t("settings.backgroundScale")}
        description={t("settings.backgroundScaleDesc")}
        value={backgroundScale}
        onValueChange={setBackgroundScale}
        min={50}
        max={200}
        step={5}
        disabled={scaleDisabled}
        unit="%"
      />

      <SliderSettingItem
        id="background-position-x"
        label={t("settings.backgroundPositionX")}
        description={t("settings.backgroundPositionXDesc")}
        value={backgroundPositionX}
        onValueChange={setBackgroundPositionX}
        min={0}
        max={100}
        step={1}
        disabled={paramsDisabled}
        unit="%"
      />

      <SliderSettingItem
        id="background-position-y"
        label={t("settings.backgroundPositionY")}
        description={t("settings.backgroundPositionYDesc")}
        value={backgroundPositionY}
        onValueChange={setBackgroundPositionY}
        min={0}
        max={100}
        step={1}
        disabled={paramsDisabled}
        unit="%"
      />
    </div>
  );
}

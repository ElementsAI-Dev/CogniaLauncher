"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { AccentColorPicker } from "./accent-color-picker";
import { SwitchSettingItem, SelectSettingItem } from "./setting-item";
import { BackgroundSettings } from "./background-settings";
import { cn } from "@/lib/utils";
import {
  INTERFACE_RADII,
  INTERFACE_RADIUS_LABELS,
  type AccentColor,
  type ChartColorTheme,
  type InterfaceRadius,
  type InterfaceDensity,
  type WindowEffect,
} from "@/lib/theme/types";
import { type WindowEffectRuntimeState } from "@/lib/theme/window-effects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

const WINDOW_EFFECT_LABEL_KEYS: Record<WindowEffect, string> = {
  auto: "settings.windowEffectAuto",
  none: "settings.windowEffectNone",
  mica: "settings.windowEffectMica",
  "mica-tabbed": "settings.windowEffectMicaTabbed",
  acrylic: "settings.windowEffectAcrylic",
  blur: "settings.windowEffectBlur",
  vibrancy: "settings.windowEffectVibrancy",
};

interface AppearanceSettingsProps {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  locale: string;
  setLocale: (locale: "en" | "zh") => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  chartColorTheme: ChartColorTheme;
  setChartColorTheme: (theme: string) => void;
  interfaceRadius: InterfaceRadius;
  setInterfaceRadius: (radius: InterfaceRadius) => void;
  interfaceDensity: InterfaceDensity;
  setInterfaceDensity: (density: InterfaceDensity) => void;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
  windowEffect: WindowEffect;
  setWindowEffect: (effect: string) => void;
  windowEffectRuntime: WindowEffectRuntimeState;
  t: (key: string, values?: Record<string, string>) => string;
}

function getWindowEffectLabel(
  effect: WindowEffect,
  t: (key: string, values?: Record<string, string>) => string,
) {
  return t(WINDOW_EFFECT_LABEL_KEYS[effect]);
}

export function AppearanceSettings({
  theme,
  setTheme,
  locale,
  setLocale,
  accentColor,
  setAccentColor,
  chartColorTheme,
  setChartColorTheme,
  interfaceRadius,
  setInterfaceRadius,
  interfaceDensity,
  setInterfaceDensity,
  reducedMotion,
  setReducedMotion,
  windowEffect,
  setWindowEffect,
  windowEffectRuntime,
  t,
}: AppearanceSettingsProps) {
  const selectedWindowEffect = windowEffectRuntime.requestedSupported
    ? windowEffect
    : "none";

  return (
    <div className="flex flex-col gap-4">
        <SelectSettingItem
          id="theme-select"
          label={t("settings.theme")}
          description={t("settings.themeDesc")}
          value={theme || "system"}
          onValueChange={setTheme}
          options={[
            { value: "light", label: t("settings.light") },
            { value: "dark", label: t("settings.dark") },
            { value: "system", label: t("settings.system") },
          ]}
          placeholder={t("settings.theme")}
          triggerClassName="w-32"
        />
        <Separator />
        <SelectSettingItem
          id="language-select"
          label={t("settings.language")}
          description={t("settings.languageDesc")}
          value={locale}
          onValueChange={(v) => setLocale(v as "en" | "zh")}
          options={[
            { value: "en", label: t("settings.english") },
            { value: "zh", label: t("settings.chinese") },
          ]}
          placeholder={t("settings.language")}
          triggerClassName="w-32"
        />
        <Separator />
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-0.5">
            <Label id="accent-color-label">{t("settings.accentColor")}</Label>
            <p id="accent-color-desc" className="text-sm text-muted-foreground">
              {t("settings.accentColorDesc")}
            </p>
          </div>
          <AccentColorPicker
            accentColor={accentColor}
            onAccentColorChange={setAccentColor}
            t={t}
            aria-labelledby="accent-color-label"
            aria-describedby="accent-color-desc"
          />
        </div>
        <Separator />
        <SelectSettingItem
          id="chart-color-theme"
          label={t("settings.chartColorTheme")}
          description={t("settings.chartColorThemeDesc")}
          value={chartColorTheme}
          onValueChange={setChartColorTheme}
          options={[
            { value: "default", label: t("settings.chartThemeDefault") },
            { value: "vibrant", label: t("settings.chartThemeVibrant") },
            { value: "pastel", label: t("settings.chartThemePastel") },
            { value: "ocean", label: t("settings.chartThemeOcean") },
            { value: "sunset", label: t("settings.chartThemeSunset") },
            { value: "monochrome", label: t("settings.chartThemeMonochrome") },
          ]}
          placeholder={t("settings.chartColorTheme")}
          triggerClassName="w-40"
        />
        <Separator />
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-0.5">
            <Label id="interface-radius-label">{t("settings.interfaceRadius")}</Label>
            <p id="interface-radius-desc" className="text-sm text-muted-foreground">
              {t("settings.interfaceRadiusDesc")}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={String(interfaceRadius)}
            onValueChange={(value) => {
              if (value) setInterfaceRadius(parseFloat(value) as InterfaceRadius);
            }}
            className="flex flex-wrap gap-2"
            aria-labelledby="interface-radius-label"
            aria-describedby="interface-radius-desc"
          >
            {INTERFACE_RADII.map((r) => (
              <ToggleGroupItem
                key={r}
                value={String(r)}
                aria-label={t("settings.selectRadius", { radius: INTERFACE_RADIUS_LABELS[r] })}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs",
                  "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
                )}
              >
                <div
                  className="h-4 w-4 border border-current"
                  style={{ borderRadius: `${r * 4}px` }}
                />
                {t(`settings.radius${INTERFACE_RADIUS_LABELS[r]}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Separator />
        <SelectSettingItem
          id="interface-density"
          label={t("settings.interfaceDensity")}
          description={t("settings.interfaceDensityDesc")}
          value={interfaceDensity}
          onValueChange={(v) => setInterfaceDensity(v as InterfaceDensity)}
          options={[
            { value: "compact", label: t("settings.densityCompact") },
            { value: "comfortable", label: t("settings.densityComfortable") },
            { value: "spacious", label: t("settings.densitySpacious") },
          ]}
          placeholder={t("settings.interfaceDensity")}
          triggerClassName="w-40"
        />
        <Separator />
        <SwitchSettingItem
          id="reduced-motion"
          label={t("settings.reducedMotion")}
          description={t("settings.reducedMotionDesc")}
          checked={reducedMotion}
          onCheckedChange={setReducedMotion}
        />
        <Separator />
        <BackgroundSettings t={t} />
        <Separator />
        <Card className="gap-4 py-4">
          <CardHeader className="gap-2 px-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-base">
                  {t("settings.windowEffectRuntimeCardTitle")}
                </CardTitle>
                <CardDescription>
                  {t("settings.windowEffectRuntimeCardDesc")}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {t("settings.windowEffectConfiguredBadge")}:{" "}
                  {getWindowEffectLabel(windowEffectRuntime.requested, t)}
                </Badge>
                {windowEffectRuntime.effective ? (
                  <Badge variant="outline">
                    {t("settings.windowEffectEffectiveBadge")}:{" "}
                    {getWindowEffectLabel(windowEffectRuntime.effective, t)}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-4">
            {!windowEffectRuntime.desktop ? (
              <Alert>
                <AlertDescription>
                  {t("settings.windowEffectDesktopOnly")}
                </AlertDescription>
              </Alert>
            ) : null}

            {windowEffectRuntime.desktop && windowEffectRuntime.unsupportedRequested ? (
              <Alert>
                <AlertDescription>
                  {t("settings.windowEffectUnsupported")}
                </AlertDescription>
              </Alert>
            ) : null}

            <Field className="gap-1.5">
              <FieldLabel htmlFor="window-effect">
                {t("settings.windowEffect")}
              </FieldLabel>
              <FieldDescription id="window-effect-desc">
                {t("settings.windowEffectDesc")}
              </FieldDescription>
            </Field>
            <Select
              value={selectedWindowEffect}
              onValueChange={setWindowEffect}
            >
              <SelectTrigger
                id="window-effect"
                className="w-56"
                aria-describedby="window-effect-desc"
              >
                <SelectValue placeholder={t("settings.windowEffect")} />
              </SelectTrigger>
              <SelectContent>
                {windowEffectRuntime.selectable.map((effect) => (
                  <SelectItem key={effect} value={effect}>
                    {getWindowEffectLabel(effect, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
    </div>
  );
}

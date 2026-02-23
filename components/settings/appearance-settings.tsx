"use client";

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
} from "@/lib/theme/types";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

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
  t: (key: string, values?: Record<string, string>) => string;
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
  t,
}: AppearanceSettingsProps) {
  return (
    <div className="space-y-4">
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
        <div className="space-y-3 py-2">
          <div className="space-y-0.5">
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
        <div className="space-y-3 py-2">
          <div className="space-y-0.5">
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
    </div>
  );
}

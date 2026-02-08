"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";
import { AccentColorPicker } from "./accent-color-picker";
import { SwitchSettingItem } from "./setting-item";
import { SelectSettingItem } from "./setting-item";
import type { AccentColor, ChartColorTheme } from "@/lib/theme/types";

interface AppearanceSettingsProps {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  locale: string;
  setLocale: (locale: "en" | "zh") => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  chartColorTheme: ChartColorTheme;
  setChartColorTheme: (theme: string) => void;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
  t: (key: string) => string;
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
  reducedMotion,
  setReducedMotion,
  t,
}: AppearanceSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" aria-hidden="true" />
          {t("settings.appearance")}
        </CardTitle>
        <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <SwitchSettingItem
          id="reduced-motion"
          label={t("settings.reducedMotion")}
          description={t("settings.reducedMotionDesc")}
          checked={reducedMotion}
          onCheckedChange={setReducedMotion}
        />
      </CardContent>
    </Card>
  );
}

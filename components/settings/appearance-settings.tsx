"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette } from "lucide-react";
import { AccentColorPicker } from "./accent-color-picker";
import type { AccentColor } from "@/lib/theme/types";

interface AppearanceSettingsProps {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  locale: string;
  setLocale: (locale: "en" | "zh") => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
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
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="theme-select">{t("settings.theme")}</Label>
            <p id="theme-desc" className="text-sm text-muted-foreground">
              {t("settings.themeDesc")}
            </p>
          </div>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger
              id="theme-select"
              className="w-32"
              aria-describedby="theme-desc"
            >
              <SelectValue placeholder={t("settings.theme")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t("settings.light")}</SelectItem>
              <SelectItem value="dark">{t("settings.dark")}</SelectItem>
              <SelectItem value="system">{t("settings.system")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="language-select">{t("settings.language")}</Label>
            <p id="language-desc" className="text-sm text-muted-foreground">
              {t("settings.languageDesc")}
            </p>
          </div>
          <Select
            value={locale}
            onValueChange={(v) => setLocale(v as "en" | "zh")}
          >
            <SelectTrigger
              id="language-select"
              className="w-32"
              aria-describedby="language-desc"
            >
              <SelectValue placeholder={t("settings.language")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("settings.english")}</SelectItem>
              <SelectItem value="zh">{t("settings.chinese")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="reduced-motion">
              {t("settings.reducedMotion")}
            </Label>
            <p
              id="reduced-motion-desc"
              className="text-sm text-muted-foreground"
            >
              {t("settings.reducedMotionDesc")}
            </p>
          </div>
          <Switch
            id="reduced-motion"
            aria-describedby="reduced-motion-desc"
            checked={reducedMotion}
            onCheckedChange={setReducedMotion}
          />
        </div>
      </CardContent>
    </Card>
  );
}

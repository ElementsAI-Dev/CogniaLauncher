"use client";

import { cn } from "@/lib/utils";
import {
  ACCENT_COLORS,
  ACCENT_COLOR_LABELS,
  ACCENT_COLOR_CSS_CLASSES,
  type AccentColor,
} from "@/lib/theme/types";
import { Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface AccentColorPickerProps {
  accentColor: AccentColor;
  onAccentColorChange: (color: AccentColor) => void;
  className?: string;
  t?: (key: string, params?: Record<string, string>) => string;
}

export function AccentColorPicker({
  accentColor,
  onAccentColorChange,
  className,
  t,
}: AccentColorPickerProps) {
  const getAriaLabel = (color: AccentColor) => {
    if (t) {
      return t("settings.selectAccentColor", {
        color: ACCENT_COLOR_LABELS[color],
      });
    }
    return `Select ${ACCENT_COLOR_LABELS[color]} accent color`;
  };

  return (
    <ToggleGroup
      type="single"
      value={accentColor}
      onValueChange={(value) => {
        if (value) onAccentColorChange(value as AccentColor);
      }}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {ACCENT_COLORS.map((color) => (
        <Tooltip key={color}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value={color}
              aria-label={getAriaLabel(color)}
              className={cn(
                "relative h-8 w-8 rounded-full p-0 transition-transform hover:scale-110 data-[state=on]:ring-2 data-[state=on]:ring-offset-2 data-[state=on]:ring-offset-background data-[state=on]:ring-foreground",
                ACCENT_COLOR_CSS_CLASSES[color],
                "hover:bg-transparent data-[state=on]:bg-transparent",
              )}
            >
              {accentColor === color && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
              )}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{ACCENT_COLOR_LABELS[color]}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}

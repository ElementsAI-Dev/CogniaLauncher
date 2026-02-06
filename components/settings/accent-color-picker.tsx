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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const accentColorOptions: AccentColor[] = ACCENT_COLORS;

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
    <TooltipProvider>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {accentColorOptions.map((color) => (
          <Tooltip key={color}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onAccentColorChange(color)}
                className={cn(
                  "relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
                  ACCENT_COLOR_CSS_CLASSES[color],
                  accentColor === color &&
                    "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                )}
                aria-label={getAriaLabel(color)}
                aria-pressed={accentColor === color}
              >
                {accentColor === color && (
                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{ACCENT_COLOR_LABELS[color]}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

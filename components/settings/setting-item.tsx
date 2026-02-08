"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem as SelectOptionItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ValidationRule {
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
}

const VALIDATION_RULES: Record<string, ValidationRule> = {
  "general.parallel_downloads": { min: 1, max: 16 },
  "general.min_install_space_mb": { min: 10, max: 10240 },
  "general.metadata_cache_ttl": { min: 60, max: 86400 },
  "network.timeout": { min: 5, max: 300 },
  "network.retries": { min: 0, max: 10 },
  "network.proxy": {
    pattern: /^(https?:\/\/.*)?$/,
    patternMessage: "validation.mustBeValidUrlOrEmpty",
  },
  "mirrors.npm": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "mirrors.pypi": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "mirrors.crates": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "mirrors.go": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "general.cache_max_size": { min: 104857600, max: 107374182400 },
  "general.cache_max_age_days": { min: 1, max: 365 },
  "general.cache_auto_clean_threshold": { min: 0, max: 100 },
  "general.cache_monitor_interval": { min: 0, max: 3600 },
  "general.download_speed_limit": { min: 0, max: 1073741824 },
};

export function validateField(
  key: string,
  value: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  const rules = VALIDATION_RULES[key];
  if (!rules) return null;

  if (rules.min !== undefined || rules.max !== undefined) {
    const num = Number(value);
    if (isNaN(num)) return t("validation.mustBeNumber");
    if (rules.min !== undefined && num < rules.min) {
      return t("validation.min", { min: rules.min });
    }
    if (rules.max !== undefined && num > rules.max) {
      return t("validation.max", { max: rules.max });
    }
  }

  if (rules.pattern && value && !rules.pattern.test(value)) {
    return rules.patternMessage
      ? t(rules.patternMessage)
      : t("validation.invalidFormat");
  }

  return null;
}

export interface SettingItemProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
  originalValue?: string;
  highlightMatch?: boolean;
  modifiedLabel?: string;
}

export function SettingItem({
  id,
  label,
  description,
  value,
  onChange,
  type = "text",
  min,
  max,
  placeholder,
  error,
  disabled = false,
  originalValue,
  highlightMatch = false,
  modifiedLabel = "Modified",
}: SettingItemProps) {
  const descId = `${id}-desc`;
  const errorId = `${id}-error`;
  const isModified = originalValue !== undefined && value !== originalValue;

  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 rounded-md transition-colors",
        highlightMatch && "bg-yellow-50 dark:bg-yellow-900/20 px-3 -mx-3",
      )}
    >
      <div className="space-y-0.5 flex-1 mr-4">
        <Label htmlFor={id} className="font-medium flex items-center gap-2">
          {label}
          {isModified && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="h-2 w-2 rounded-full bg-amber-500"
                  aria-label={modifiedLabel}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                {modifiedLabel}
              </TooltipContent>
            </Tooltip>
          )}
        </Label>
        <p id={descId} className="text-sm text-muted-foreground">
          {description}
        </p>
        {error && (
          <p
            id={errorId}
            className="text-sm text-destructive mt-1"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? `${descId} ${errorId}` : descId}
        aria-invalid={!!error}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-48",
          error && "border-destructive",
          isModified && "border-amber-500",
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SwitchSettingItem — reusable Switch + Label + description row
// ---------------------------------------------------------------------------

export interface SwitchSettingItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  highlightMatch?: boolean;
}

export function SwitchSettingItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  highlightMatch = false,
}: SwitchSettingItemProps) {
  const descId = `${id}-desc`;

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 rounded-md transition-colors",
        highlightMatch && "bg-yellow-50 dark:bg-yellow-900/20 px-3 -mx-3",
      )}
    >
      <div className="space-y-0.5 flex-1 mr-4">
        <Label htmlFor={id}>{label}</Label>
        <p id={descId} className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={descId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelectSettingItem — reusable Select + Label + description row
// ---------------------------------------------------------------------------

export interface SelectSettingItemOption {
  value: string;
  label: string;
}

export interface SelectSettingItemProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectSettingItemOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  highlightMatch?: boolean;
}

export function SelectSettingItem({
  id,
  label,
  description,
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  triggerClassName,
  highlightMatch = false,
}: SelectSettingItemProps) {
  const descId = `${id}-desc`;

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 rounded-md transition-colors",
        highlightMatch && "bg-yellow-50 dark:bg-yellow-900/20 px-3 -mx-3",
      )}
    >
      <div className="space-y-0.5 flex-1 mr-4">
        <Label htmlFor={id}>{label}</Label>
        <p id={descId} className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn("w-48", triggerClassName)}
          aria-describedby={descId}
        >
          <SelectValue placeholder={placeholder || label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectOptionItem key={option.value} value={option.value}>
              {option.label}
            </SelectOptionItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

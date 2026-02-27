"use client";

import { useCallback, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardDrive,
  ShieldAlert,
  Info,
} from "lucide-react";
import { isTauri, validatePath } from "@/lib/tauri";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePathValidation } from "@/hooks/use-path-validation";

interface PathsSettingsProps {
  localConfig: Record<string, string>;
  errors: Record<string, string | null>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function PathsSettings({
  localConfig,
  errors,
  onValueChange,
  t,
}: PathsSettingsProps) {
  const handleBrowse = useCallback(
    async (key: string, title: string): Promise<string | null> => {
      if (!isTauri()) {
        toast.info(t("settings.pathManualRequired"));
        return null;
      }

      try {
        const dialogModule = await import(
          "@tauri-apps/plugin-dialog"
        ).catch(() => null);
        if (dialogModule?.open) {
          const selected = await dialogModule.open({
            directory: true,
            multiple: false,
            title,
          });
          if (selected && typeof selected === "string") {
            onValueChange(key, selected);
            return selected;
          }
        } else {
          toast.info(t("settings.pathManualRequired"));
        }
      } catch {
        toast.info(t("settings.pathManualRequired"));
      }
      return null;
    },
    [onValueChange, t],
  );

  return (
    <div className="space-y-4">
        <PathInputItem
          id="paths-root"
          label={t("settings.pathRoot")}
          description={t("settings.pathRootDesc")}
          value={localConfig["paths.root"] || ""}
          onChange={(value) => onValueChange("paths.root", value)}
          onBrowse={() =>
            handleBrowse("paths.root", t("settings.pathRoot"))
          }
          placeholder={t("settings.pathRootPlaceholder")}
          externalError={errors["paths.root"]}
          t={t}
        />
        <Separator />
        <PathInputItem
          id="paths-cache"
          label={t("settings.pathCache")}
          description={t("settings.pathCacheDesc")}
          value={localConfig["paths.cache"] || ""}
          onChange={(value) => onValueChange("paths.cache", value)}
          onBrowse={() =>
            handleBrowse("paths.cache", t("settings.pathCache"))
          }
          placeholder={t("settings.pathCachePlaceholder")}
          externalError={errors["paths.cache"]}
          t={t}
        />
        <Separator />
        <PathInputItem
          id="paths-environments"
          label={t("settings.pathEnvironments")}
          description={t("settings.pathEnvironmentsDesc")}
          value={localConfig["paths.environments"] || ""}
          onChange={(value) => onValueChange("paths.environments", value)}
          onBrowse={() =>
            handleBrowse(
              "paths.environments",
              t("settings.pathEnvironments"),
            )
          }
          placeholder={t("settings.pathEnvironmentsPlaceholder")}
          externalError={errors["paths.environments"]}
          t={t}
        />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PathInputItem — path input with debounced validation
// ---------------------------------------------------------------------------

interface PathInputItemProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  onBrowse: () => Promise<string | null>;
  placeholder?: string;
  externalError?: string | null;
  t: (key: string) => string;
}

function PathInputItem({
  id,
  label,
  description,
  value,
  onChange,
  onBrowse,
  placeholder,
  externalError,
  t,
}: PathInputItemProps) {
  const {
    status,
    validation,
    displayError: hookDisplayError,
    displayWarnings,
    setStatus,
    setValidation,
    setClientError,
  } = usePathValidation({ value, t });

  const [isBrowsing, setIsBrowsing] = useState(false);

  // Determine displayed error: external (from parent) > hook error
  const displayError = externalError || hookDisplayError;

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleBrowseClick = useCallback(async () => {
    setIsBrowsing(true);
    try {
      const selected = await onBrowse();
      if (selected) {
        // Immediately validate the selected path (no debounce)
        if (isTauri()) {
          setStatus("validating");
          try {
            const result = await validatePath(selected, true);
            setValidation(result);
            setClientError(null);
            if (!result.isValid) {
              setStatus("error");
            } else if (result.warnings.length > 0) {
              setStatus("warning");
            } else {
              setStatus("valid");
            }
          } catch {
            setStatus("idle");
          }
        }
      }
    } finally {
      setIsBrowsing(false);
    }
  }, [onBrowse, setStatus, setValidation, setClientError]);

  const handleClear = useCallback(() => {
    onChange("");
    setStatus("idle");
    setValidation(null);
    setClientError(null);
  }, [onChange, setStatus, setValidation, setClientError]);

  // Status icon
  const StatusIcon = () => {
    if (!value.trim()) return null;
    switch (status) {
      case "validating":
        return (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            aria-label={t("settings.pathValidation.validating")}
          />
        );
      case "valid":
        return (
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-green-500"
            aria-label={t("settings.pathValidation.valid")}
          />
        );
      case "warning":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-amber-500 cursor-help"
                aria-label={t("settings.pathValidation.hasWarnings")}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <ul className="text-xs space-y-0.5">
                {displayWarnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        );
      case "error":
        return (
          <XCircle
            className="h-4 w-4 shrink-0 text-destructive"
            aria-label={t("settings.pathValidation.invalid")}
          />
        );
      default:
        return null;
    }
  };

  return (
      <div className="space-y-2 py-2">
        <div className="space-y-0.5">
          <Label htmlFor={id} className="flex items-center gap-1.5">
            {label}
            {validation?.hasTraversal && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t("settings.pathValidation.traversalWarning")}
                </TooltipContent>
              </Tooltip>
            )}
          </Label>
          <p id={`${id}-desc`} className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id={id}
              type="text"
              value={value}
              onChange={handleInputChange}
              placeholder={placeholder}
              aria-describedby={`${id}-desc`}
              aria-invalid={!!displayError}
              className={cn(
                "pr-8",
                displayError && "border-destructive focus-visible:ring-destructive/30",
                status === "warning" && "border-amber-500 focus-visible:ring-amber-500/30",
                status === "valid" && value.trim() && "border-green-500 focus-visible:ring-green-500/30",
              )}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <StatusIcon />
            </div>
          </div>

          {isTauri() && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleBrowseClick}
                  disabled={isBrowsing}
                  aria-label={t("settings.pathBrowse")}
                >
                  {isBrowsing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("settings.pathBrowse")}
              </TooltipContent>
            </Tooltip>
          )}

          {value.trim() && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                  aria-label={t("settings.pathValidation.clearPath")}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("settings.pathValidation.clearPath")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Error message */}
        {displayError && (
          <p className="text-sm text-destructive flex items-center gap-1" role="alert">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            {displayError}
          </p>
        )}

        {/* Validation detail badges */}
        {validation && validation.isValid && value.trim() && status !== "validating" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {/* Existence */}
            <Badge
              variant="outline"
              className={cn(
                validation.exists
                  ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
              )}
            >
              {validation.exists ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Info className="h-3 w-3" />
              )}
              {validation.exists
                ? t("settings.pathValidation.exists")
                : t("settings.pathValidation.willCreate")}
            </Badge>

            {/* Writable */}
            {validation.exists && (
              <Badge
                variant={validation.writable ? "outline" : "destructive"}
                className={cn(
                  validation.writable &&
                    "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
                )}
              >
                {validation.writable ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {validation.writable
                  ? t("settings.pathValidation.writable")
                  : t("settings.pathValidation.notWritable")}
              </Badge>
            )}

            {/* Parent writable (when path doesn't exist) */}
            {!validation.exists && validation.parentExists && (
              <Badge
                variant={validation.parentWritable ? "outline" : "destructive"}
                className={cn(
                  validation.parentWritable &&
                    "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
                )}
              >
                {validation.parentWritable ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {validation.parentWritable
                  ? t("settings.pathValidation.parentWritable")
                  : t("settings.pathValidation.parentNotWritable")}
              </Badge>
            )}

            {/* Disk space */}
            {validation.diskAvailable > 0 && (
              <Badge variant="secondary">
                <HardDrive className="h-3 w-3" />
                {t("settings.pathValidation.diskSpace")}: {validation.diskAvailableHuman}
              </Badge>
            )}
          </div>
        )}
      </div>
  );
}

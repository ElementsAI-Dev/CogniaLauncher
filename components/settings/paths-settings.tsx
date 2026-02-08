"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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
import type { PathValidationResult } from "@/types/tauri";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.paths")}</CardTitle>
        <CardDescription>{t("settings.pathsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Frontend-only path pre-validation (fast, no backend call needed)
// ---------------------------------------------------------------------------

const MAX_PATH_LENGTH = 4096;

const DANGEROUS_CHARS_RE = /[\0`${}|><;]/;
const SHELL_INJECTION_RE = /\$\(|&&|\|\|/;

/** Quick client-side check before hitting the backend */
function preValidatePath(
  value: string,
  t: (key: string) => string,
): { ok: boolean; error?: string } {
  if (!value.trim()) return { ok: true }; // empty = default

  if (value.length > MAX_PATH_LENGTH) {
    return { ok: false, error: t("settings.pathValidation.tooLong") };
  }

  if (DANGEROUS_CHARS_RE.test(value) || SHELL_INJECTION_RE.test(value)) {
    return {
      ok: false,
      error: t("settings.pathValidation.dangerousChars"),
    };
  }

  // Basic absolute-path check (cross-platform)
  const isAbsolute =
    /^[a-zA-Z]:[\\/]/.test(value) || // Windows: C:\, D:/
    value.startsWith("/"); // Unix: /home/...
  if (!isAbsolute) {
    return {
      ok: false,
      error: t("settings.pathValidation.mustBeAbsolute"),
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validation state type
// ---------------------------------------------------------------------------

type ValidationStatus = "idle" | "validating" | "valid" | "warning" | "error";

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
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [validation, setValidation] = useState<PathValidationResult | null>(
    null,
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0); // monotonic counter to cancel stale validations

  // Debounced backend validation
  const triggerValidation = useCallback(
    (pathValue: string) => {
      // Clear pending debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Client-side pre-check
      const pre = preValidatePath(pathValue, t);
      if (!pre.ok) {
        setClientError(pre.error ?? null);
        setStatus("error");
        setValidation(null);
        return;
      }
      setClientError(null);

      // Empty path = use default, no backend call needed
      if (!pathValue.trim()) {
        setStatus("idle");
        setValidation(null);
        return;
      }

      // Only call backend in Tauri environment
      if (!isTauri()) {
        setStatus("idle");
        setValidation(null);
        return;
      }

      setStatus("validating");

      const callId = ++abortRef.current;

      debounceRef.current = setTimeout(async () => {
        try {
          const result = await validatePath(pathValue, true);
          // Ignore if a newer call has been triggered
          if (callId !== abortRef.current) return;

          setValidation(result);
          if (!result.isValid) {
            setStatus("error");
          } else if (result.warnings.length > 0) {
            setStatus("warning");
          } else {
            setStatus("valid");
          }
        } catch {
          if (callId !== abortRef.current) return;
          setStatus("error");
          setValidation(null);
          setClientError(t("settings.pathValidation.backendError"));
        }
      }, 600);
    },
    [t],
  );

  // Validate when value changes
  useEffect(() => {
    triggerValidation(value);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, triggerValidation]);

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
  }, [onBrowse]);

  const handleClear = useCallback(() => {
    onChange("");
    setStatus("idle");
    setValidation(null);
    setClientError(null);
  }, [onChange]);

  // Determine displayed error: external (from parent) > client > backend
  const displayError =
    externalError ||
    clientError ||
    (validation && !validation.isValid
      ? validation.errors.map((e) => t(`settings.pathValidation.be.${e}`) !== `settings.pathValidation.be.${e}` ? t(`settings.pathValidation.be.${e}`) : e).join("; ")
      : null);

  const displayWarnings =
    validation && validation.isValid && validation.warnings.length > 0
      ? validation.warnings
      : [];

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
    <TooltipProvider>
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
    </TooltipProvider>
  );
}

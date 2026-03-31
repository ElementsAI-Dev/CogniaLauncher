'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri, validatePath } from "@/lib/tauri";
import { preValidatePath } from "@/lib/validation/path";
import type { PathValidationResult } from "@/types/tauri";
import type { ValidationStatus } from "@/types/settings";

export interface UsePathValidationOptions {
  value: string;
  t: (key: string) => string;
}

export interface UsePathValidationReturn {
  status: ValidationStatus;
  validation: PathValidationResult | null;
  clientError: string | null;
  displayError: string | null;
  displayWarnings: string[];
  triggerValidation: (pathValue: string) => void;
  setStatus: (status: ValidationStatus) => void;
  setValidation: (result: PathValidationResult | null) => void;
  setClientError: (error: string | null) => void;
  resetValidation: () => void;
}

/**
 * Hook for debounced path validation with client-side pre-check + backend validation
 * Extracted from components/settings/paths-settings.tsx PathInputItem
 */
export function usePathValidation({
  value,
  t,
}: UsePathValidationOptions): UsePathValidationReturn {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [validation, setValidation] = useState<PathValidationResult | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
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

  // Validate when value changes — schedule via microtask to avoid sync setState in effect
  useEffect(() => {
    const id = setTimeout(() => triggerValidation(value), 0);
    return () => {
      clearTimeout(id);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, triggerValidation]);

  const resetValidation = useCallback(() => {
    setStatus("idle");
    setValidation(null);
    setClientError(null);
  }, []);

  // Determine displayed error: client > backend
  const displayError =
    clientError ||
    (validation && !validation.isValid
      ? validation.errors.map((e) => t(`settings.pathValidation.be.${e}`) !== `settings.pathValidation.be.${e}` ? t(`settings.pathValidation.be.${e}`) : e).join("; ")
      : null);

  const displayWarnings =
    validation && validation.isValid && validation.warnings.length > 0
      ? validation.warnings
      : [];

  return {
    status,
    validation,
    clientError,
    displayError,
    displayWarnings,
    triggerValidation,
    setStatus,
    setValidation,
    setClientError,
    resetValidation,
  };
}

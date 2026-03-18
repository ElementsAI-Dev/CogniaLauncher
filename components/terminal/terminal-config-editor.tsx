"use client";

import { useEffect, useState } from "react";
import type { TerminalConfigEditorCapability } from "@/types/tauri";
import { TerminalConfigEditorFallback } from "./config-editor/fallback-surface";
import { TerminalConfigEditorWorkspace } from "./config-editor/editor-workspace";
import type {
  TerminalConfigEditorProps,
  TerminalConfigEditorSurfaceComponent,
} from "./config-editor/types";

function toRuntimeFallbackCapability(
  capability: TerminalConfigEditorCapability | null | undefined,
): TerminalConfigEditorCapability | null {
  if (!capability || capability.mode !== "enhanced") {
    return capability ?? null;
  }

  return {
    ...capability,
    mode: "fallback",
    enhancementLevel: "basic",
    bundleId: null,
    bundleLabel: null,
    supportsCompletion: false,
    supportsInlineDiagnostics: false,
    fallbackReason:
      "Enhanced editor runtime failed to initialize. Falling back to the plain text editor.",
  };
}

export function TerminalConfigEditor(props: TerminalConfigEditorProps) {
  const [SurfaceComponent, setSurfaceComponent] =
    useState<TerminalConfigEditorSurfaceComponent>(
      () => TerminalConfigEditorFallback,
    );
  const [resolvedCapability, setResolvedCapability] =
    useState<TerminalConfigEditorCapability | null>(props.capability ?? null);

  useEffect(() => {
    let cancelled = false;

    const loadSurface = async () => {
      const requestedEnhanced = props.capability?.mode === "enhanced";
      try {
        if (requestedEnhanced) {
          const mod = await import("./config-editor/enhanced-surface");
          if (!cancelled) {
            setSurfaceComponent(() => mod.TerminalConfigEditorEnhanced);
            setResolvedCapability(props.capability ?? null);
          }
          return;
        }

        const mod = await import("./config-editor/highlighted-surface");
        if (!cancelled) {
          setSurfaceComponent(() => mod.TerminalConfigEditorHighlighted);
          setResolvedCapability(props.capability ?? null);
        }
      } catch {
        if (!cancelled) {
          setSurfaceComponent(() => TerminalConfigEditorFallback);
          setResolvedCapability(toRuntimeFallbackCapability(props.capability));
        }
      }
    };

    void loadSurface();
    return () => {
      cancelled = true;
    };
  }, [props.capability]);

  return (
    <TerminalConfigEditorWorkspace
      SurfaceComponent={SurfaceComponent}
      capability={resolvedCapability}
      {...props}
    />
  );
}

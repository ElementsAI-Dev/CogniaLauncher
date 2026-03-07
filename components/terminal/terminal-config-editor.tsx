"use client";

import { useEffect, useState } from "react";
import { TerminalConfigEditorFallback } from "./config-editor/fallback-surface";
import { TerminalConfigEditorWorkspace } from "./config-editor/editor-workspace";
import type {
  TerminalConfigEditorProps,
  TerminalConfigEditorSurfaceComponent,
} from "./config-editor/types";

export function TerminalConfigEditor(props: TerminalConfigEditorProps) {
  const [SurfaceComponent, setSurfaceComponent] =
    useState<TerminalConfigEditorSurfaceComponent>(
      () => TerminalConfigEditorFallback,
    );

  useEffect(() => {
    let cancelled = false;
    import("./config-editor/highlighted-surface")
      .then((mod) => {
        if (!cancelled) {
          setSurfaceComponent(() => mod.TerminalConfigEditorHighlighted);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSurfaceComponent(() => TerminalConfigEditorFallback);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TerminalConfigEditorWorkspace
      SurfaceComponent={SurfaceComponent}
      {...props}
    />
  );
}

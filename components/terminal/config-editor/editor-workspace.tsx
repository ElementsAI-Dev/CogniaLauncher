"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDiagnosticSummaryLabel,
  TerminalConfigEditorDiagnosticsPanel,
} from "./diagnostics-panel";
import { TerminalConfigEditorDiffPreview } from "./diff-preview";
import { TerminalConfigEditorToolbar } from "./editor-toolbar";
import type {
  TerminalConfigEditorView,
  TerminalConfigEditorWorkspaceProps,
} from "./types";

export function TerminalConfigEditorWorkspace({
  SurfaceComponent,
  baselineValue = null,
  configPath = null,
  diagnostics = [],
  fingerprint = null,
  language,
  onChange,
  shellType = null,
  snapshotPath = null,
  value,
}: TerminalConfigEditorWorkspaceProps) {
  const lineCount = useMemo(
    () => Math.max(1, value.split("\n").length),
    [value],
  );
  const hasDiagnostics = diagnostics.length > 0;
  const hasPendingChanges = baselineValue != null && value !== baselineValue;
  const [requestedView, setRequestedView] =
    useState<TerminalConfigEditorView>("editor");

  const activeView = useMemo<TerminalConfigEditorView>(() => {
    if (requestedView === "diagnostics" && !hasDiagnostics) {
      return "editor";
    }

    if (requestedView === "changes" && !hasPendingChanges) {
      return "editor";
    }

    return requestedView;
  }, [hasDiagnostics, hasPendingChanges, requestedView]);

  return (
    <Card data-testid="terminal-config-editor-workspace">
      <CardContent className="space-y-4 pt-6">
        <TerminalConfigEditorToolbar
          configPath={configPath}
          fingerprint={fingerprint}
          hasDiagnostics={hasDiagnostics}
          hasPendingChanges={hasPendingChanges}
          language={language}
          lineCount={lineCount}
          shellType={shellType}
          snapshotPath={snapshotPath}
        />

        {hasDiagnostics && (
          <p className="text-sm font-medium text-destructive">
            {getDiagnosticSummaryLabel(diagnostics.length)}
          </p>
        )}

        <Tabs
          value={activeView}
          onValueChange={(nextValue) =>
            setRequestedView(nextValue as TerminalConfigEditorView)
          }
        >
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            {hasDiagnostics && (
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            )}
            {hasPendingChanges && (
              <TabsTrigger value="changes">Changes</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="editor">
            <SurfaceComponent
              value={value}
              language={language}
              diagnostics={diagnostics}
              onChange={onChange}
            />
          </TabsContent>

          {hasDiagnostics && (
            <TabsContent value="diagnostics">
              <TerminalConfigEditorDiagnosticsPanel diagnostics={diagnostics} />
            </TabsContent>
          )}

          {hasPendingChanges && baselineValue != null && (
            <TabsContent value="changes">
              <TerminalConfigEditorDiffPreview
                baselineValue={baselineValue}
                value={value}
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocale } from "@/components/providers/locale-provider";
import {
  getDiagnosticSummaryLabel,
  TerminalConfigEditorDiagnosticsPanel,
} from "./diagnostics-panel";
import { TerminalConfigEditorDiffPreview } from "./diff-preview";
import { TerminalConfigStructuredEditor } from "./structured-editor";
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
  onStructuredEntriesChange,
  shellType = null,
  snapshotPath = null,
  structuredEntries = null,
  structuredFallbackReason = null,
  value,
}: TerminalConfigEditorWorkspaceProps) {
  const { t } = useLocale();
  const lineCount = useMemo(
    () => Math.max(1, value.split("\n").length),
    [value],
  );
  const hasDiagnostics = diagnostics.length > 0;
  const hasPendingChanges = baselineValue != null && value !== baselineValue;
  const hasStructuredEntries =
    Boolean(structuredEntries) && typeof onStructuredEntriesChange === "function";
  const structuredFallback = structuredFallbackReason ?? null;
  const [requestedView, setRequestedView] =
    useState<TerminalConfigEditorView>("editor");

  const activeView = useMemo<TerminalConfigEditorView>(() => {
    if (requestedView === "structured" && (!hasStructuredEntries || structuredFallback)) {
      return "editor";
    }

    if (requestedView === "diagnostics" && !hasDiagnostics) {
      return "editor";
    }

    if (requestedView === "changes" && !hasPendingChanges) {
      return "editor";
    }

    return requestedView;
  }, [
    hasDiagnostics,
    hasPendingChanges,
    hasStructuredEntries,
    requestedView,
    structuredFallback,
  ]);

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
          <Alert variant="destructive">
            <AlertTitle>{getDiagnosticSummaryLabel(diagnostics.length, t)}</AlertTitle>
            <AlertDescription>
              {t("terminal.editorDiagnosticsApplyHint")}
            </AlertDescription>
          </Alert>
        )}

        {structuredFallback && (
          <Alert>
            <AlertTitle>{t("terminal.structuredEditingUnavailable")}</AlertTitle>
            <AlertDescription>{structuredFallback}</AlertDescription>
          </Alert>
        )}

        <Tabs
          value={activeView}
          onValueChange={(nextValue) =>
            setRequestedView(nextValue as TerminalConfigEditorView)
          }
        >
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="editor">{t("terminal.editorViewEditor")}</TabsTrigger>
            {hasStructuredEntries && (
              <TabsTrigger value="structured" disabled={Boolean(structuredFallback)}>
                {t("terminal.editorViewStructured")}
              </TabsTrigger>
            )}
            {hasDiagnostics && (
              <TabsTrigger value="diagnostics">{t("terminal.editorViewDiagnostics")}</TabsTrigger>
            )}
            {hasPendingChanges && (
              <TabsTrigger value="changes">{t("terminal.editorViewChanges")}</TabsTrigger>
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

          {hasStructuredEntries && structuredEntries && onStructuredEntriesChange && (
            <TabsContent value="structured">
              <TerminalConfigStructuredEditor
                entries={structuredEntries}
                onChange={onStructuredEntriesChange}
                fallbackReason={structuredFallback}
              />
            </TabsContent>
          )}

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

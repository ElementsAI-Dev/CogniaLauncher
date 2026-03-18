'use client';

import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { loadTerminalMonacoRuntime, createDiagnosticMarkers } from '@/lib/terminal/editor/runtime/load-monaco';
import type { TerminalConfigEditorSurfaceProps } from './types';

export function TerminalConfigEditorEnhanced({
  capability,
  diagnostics = [],
  onChange,
  value,
}: TerminalConfigEditorSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const capabilityRef = useRef(capability);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const latestValueRef = useRef(value);
  const modelRef = useRef<import('monaco-editor').editor.ITextModel | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const syncingExternalValueRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    capabilityRef.current = capability;
  }, [capability]);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    const activeCapability = capabilityRef.current;
    if (!activeCapability || activeCapability.mode !== 'enhanced' || !containerRef.current) {
      return;
    }

    let disposed = false;

    const mountEditor = async () => {
      try {
        const runtime = await loadTerminalMonacoRuntime(activeCapability);
        if (disposed || !containerRef.current) {
          return;
        }

        const monaco = runtime.monaco;
        monacoRef.current = monaco;
        const model = monaco.editor.createModel(latestValueRef.current, activeCapability.languageId);
        modelRef.current = model;

        const editor = monaco.editor.create(containerRef.current, {
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          lineNumbers: 'on',
          padding: { top: 12, bottom: 12 },
          roundedSelection: false,
          model,
          tabSize: 2,
          insertSpaces: true,
          fontSize: 12,
          theme: runtime.themeName,
          renderValidationDecorations: 'editable',
          suggest: {
            showWords: false,
            snippetsPreventQuickSuggestions: false,
          },
        });

        editorRef.current = editor;
        editor.onDidChangeModelContent(() => {
          if (syncingExternalValueRef.current) {
            return;
          }
          onChange(editor.getValue());
        });

        monaco.editor.setModelMarkers(model, 'terminal-config', []);
      } catch (error) {
        if (!disposed) {
          setLoadError(String(error));
        }
      }
    };

    void mountEditor();

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
      modelRef.current?.dispose();
      modelRef.current = null;
    };
  }, [
    capability?.mode,
    capability?.bundleId,
    capability?.languageId,
    onChange,
  ]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model || model.getValue() === value) {
      return;
    }

    syncingExternalValueRef.current = true;
    model.setValue(value);
    syncingExternalValueRef.current = false;
  }, [value]);

  useEffect(() => {
    if (!monacoRef.current || !modelRef.current) {
      return;
    }

    monacoRef.current.editor.setModelMarkers(
      modelRef.current,
      'terminal-config',
      createDiagnosticMarkers(monacoRef.current, diagnostics),
    );
  }, [diagnostics]);

  if (!capability || capability.mode !== 'enhanced' || loadError) {
    return (
      <div className="space-y-2">
        {loadError && (
          <p className="text-sm text-destructive">{loadError}</p>
        )}
        <Textarea
          data-testid="terminal-config-editor-enhanced"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-65 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 shadow-none focus-visible:ring-0"
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="terminal-config-editor-enhanced"
      className="min-h-65 overflow-hidden rounded-md border bg-background"
    >
      <div ref={containerRef} className="h-[420px] w-full" />
    </div>
  );
}

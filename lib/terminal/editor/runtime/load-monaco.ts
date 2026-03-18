import type { editor as MonacoEditorNamespace, IDisposable, languages as MonacoLanguagesNamespace } from 'monaco-editor';
import type { TerminalConfigEditorCapability } from '@/types/tauri';
import { buildTerminalEditorCompletionItems } from '@/lib/terminal/editor/capability-registry';

type MonacoModule = typeof import('monaco-editor');

interface MonacoRuntime {
  monaco: MonacoModule;
  themeName: string;
}

type MonacoEnvironmentGlobal = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker?: (workerId: string, label: string) => Worker;
  };
};

const THEME_NAME = 'terminal-shell-enhanced';
let runtimePromise: Promise<MonacoRuntime> | null = null;
const registeredLanguages = new Set<string>();
const registeredCompletions = new Map<string, IDisposable>();

function ensureWorkerFactory() {
  const runtimeGlobal = globalThis as MonacoEnvironmentGlobal;
  if (runtimeGlobal.MonacoEnvironment?.getWorker) {
    return;
  }

  runtimeGlobal.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      return new Worker(
        new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
        {
          type: 'module',
          name: label || 'terminal-editor-worker',
        },
      );
    },
  };
}

function getPosixMonarchLanguage(): MonacoLanguagesNamespace.IMonarchLanguage {
  return {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\b(alias|export|source|if|then|elif|else|fi|for|do|done|while|function|return)\b/, 'keyword'],
        [/\$[a-zA-Z_][\w]*/, 'variable'],
        [/\$\{[^}]+\}/, 'variable'],
        [/".*?"/, 'string'],
        [/'[^']*'/, 'string'],
        [/\b\d+\b/, 'number'],
      ],
    },
  };
}

function getPowerShellMonarchLanguage(): MonacoLanguagesNamespace.IMonarchLanguage {
  return {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\b(function|param|if|elseif|else|switch|foreach|for|while|return|try|catch|finally)\b/i, 'keyword'],
        [/\$[a-zA-Z_][\w:]*/, 'variable'],
        [/".*?"/, 'string'],
        [/'[^']*'/, 'string'],
        [/\b\d+\b/, 'number'],
        [/-[a-zA-Z][\w-]*/, 'keyword'],
      ],
    },
  };
}

function ensureTheme(monaco: MonacoModule) {
  monaco.editor.defineTheme(THEME_NAME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6B7280' },
      { token: 'keyword', foreground: '1D4ED8', fontStyle: 'bold' },
      { token: 'variable', foreground: '047857' },
      { token: 'string', foreground: 'B45309' },
      { token: 'number', foreground: '7C3AED' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editorLineNumber.foreground': '#94A3B8',
      'editorLineNumber.activeForeground': '#0F172A',
      'editorGutter.background': '#FFFFFF',
      'editor.selectionBackground': '#DBEAFE',
      'editor.inactiveSelectionBackground': '#EFF6FF',
    },
  });
}

function ensureLanguageRegistration(
  monaco: MonacoModule,
  capability: TerminalConfigEditorCapability,
) {
  if (capability.mode !== 'enhanced' || registeredLanguages.has(capability.languageId)) {
    return;
  }

  monaco.languages.register({ id: capability.languageId });
  monaco.languages.setLanguageConfiguration(capability.languageId, {
    comments: { lineComment: '#' },
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '(', close: ')' },
      { open: '{', close: '}' },
      { open: '[', close: ']' },
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '(', close: ')' },
      { open: '{', close: '}' },
      { open: '[', close: ']' },
    ],
  });

  monaco.languages.setMonarchTokensProvider(
    capability.languageId,
    capability.bundleId === 'powershell-profile-vscode-compat'
      ? getPowerShellMonarchLanguage()
      : getPosixMonarchLanguage(),
  );

  const completionItems = buildTerminalEditorCompletionItems(capability);
  if (completionItems.length > 0 && !registeredCompletions.has(capability.languageId)) {
    registeredCompletions.set(
      capability.languageId,
      monaco.languages.registerCompletionItemProvider(capability.languageId, {
        triggerCharacters: ['$', '-'],
        provideCompletionItems(model, position) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          return {
            suggestions: completionItems.map((item) => ({
              label: item.label,
              detail: item.detail,
              kind:
                item.kind === 'snippet'
                  ? monaco.languages.CompletionItemKind.Snippet
                  : monaco.languages.CompletionItemKind.Keyword,
              insertText: item.insertText,
              range,
              ...(item.insertTextRules === 'snippet'
                ? {
                    insertTextRules:
                      monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  }
                : {}),
            })),
          };
        },
      }),
    );
  }

  registeredLanguages.add(capability.languageId);
}

async function createRuntime(): Promise<MonacoRuntime> {
  ensureWorkerFactory();
  const monaco = await import('monaco-editor');
  ensureTheme(monaco);
  return {
    monaco,
    themeName: THEME_NAME,
  };
}

export async function loadTerminalMonacoRuntime(
  capability: TerminalConfigEditorCapability,
): Promise<MonacoRuntime> {
  if (!runtimePromise) {
    runtimePromise = createRuntime();
  }

  const runtime = await runtimePromise;
  ensureLanguageRegistration(runtime.monaco, capability);
  runtime.monaco.editor.setTheme(runtime.themeName);
  return runtime;
}

export function createDiagnosticMarkers(
  monaco: MonacoModule,
  diagnostics: Array<{
    message: string;
    category: string;
    location: {
      line: number | null;
      column: number | null;
      endLine: number | null;
      endColumn: number | null;
    } | null;
  }>,
): MonacoEditorNamespace.IMarkerData[] {
  return diagnostics.map((diagnostic) => ({
    message: diagnostic.message,
    severity:
      diagnostic.category === 'validation'
        ? monaco.MarkerSeverity.Error
        : monaco.MarkerSeverity.Warning,
    startLineNumber: diagnostic.location?.line ?? 1,
    startColumn: diagnostic.location?.column ?? 1,
    endLineNumber: diagnostic.location?.endLine ?? diagnostic.location?.line ?? 1,
    endColumn: diagnostic.location?.endColumn ?? diagnostic.location?.column ?? 1,
  }));
}

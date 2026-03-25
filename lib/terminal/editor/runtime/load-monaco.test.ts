import type { TerminalConfigEditorCapability } from '@/types/tauri';

const buildTerminalEditorCompletionItemsMock = jest.fn();

jest.mock('@/lib/terminal/editor/capability-registry', () => ({
  buildTerminalEditorCompletionItems: (...args: unknown[]) =>
    buildTerminalEditorCompletionItemsMock(...args),
}));

describe('load-monaco runtime', () => {
  const originalMonacoEnvironment = (globalThis as typeof globalThis & {
    MonacoEnvironment?: unknown;
  }).MonacoEnvironment;
  const originalWorker = globalThis.Worker;

  function createMonacoMock() {
    const defineTheme = jest.fn();
    const setTheme = jest.fn();
    const register = jest.fn();
    const setLanguageConfiguration = jest.fn();
    const setMonarchTokensProvider = jest.fn();
    const registerCompletionItemProvider = jest.fn(() => ({
      dispose: jest.fn(),
    }));

    return {
      editor: {
        defineTheme,
        setTheme,
      },
      languages: {
        register,
        setLanguageConfiguration,
        setMonarchTokensProvider,
        registerCompletionItemProvider,
        CompletionItemKind: {
          Snippet: 'snippet-kind',
          Keyword: 'keyword-kind',
        },
        CompletionItemInsertTextRule: {
          InsertAsSnippet: 'insert-as-snippet',
        },
      },
      MarkerSeverity: {
        Error: 8,
        Warning: 4,
      },
    };
  }

  async function loadRuntimeModule() {
    jest.resetModules();
    return import('./load-monaco');
  }

  beforeEach(() => {
    buildTerminalEditorCompletionItemsMock.mockReset();
    delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown })
      .MonacoEnvironment;
    class WorkerStub {
      url: URL;
      options: WorkerOptions | undefined;

      constructor(url: URL | string, options?: WorkerOptions) {
        this.url = typeof url === 'string' ? new URL(url) : url;
        this.options = options;
      }
    }
    globalThis.Worker = WorkerStub as typeof Worker;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMonacoEnvironment === undefined) {
      delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown })
        .MonacoEnvironment;
    } else {
      (
        globalThis as typeof globalThis & {
          MonacoEnvironment?: unknown;
        }
      ).MonacoEnvironment = originalMonacoEnvironment;
    }
    globalThis.Worker = originalWorker;
  });

  it('creates an enhanced runtime once and registers POSIX language support', async () => {
    const monacoMock = createMonacoMock();
    jest.doMock('monaco-editor', () => monacoMock, { virtual: true });
    buildTerminalEditorCompletionItemsMock.mockReturnValue([
      {
        label: 'export',
        detail: 'Shell export snippet',
        insertText: 'export ${1:NAME}="${2:value}"',
        insertTextRules: 'snippet',
        kind: 'snippet',
      },
      {
        label: '$PROFILE',
        detail: 'Profile variable',
        insertText: '$PROFILE',
        insertTextRules: 'plain',
        kind: 'keyword',
      },
    ]);

    const capability: TerminalConfigEditorCapability = {
      mode: 'enhanced',
      enhancementLevel: 'enhanced',
      bundleId: 'shell-posix-vscode-compat',
      bundleLabel: 'POSIX Shell Essentials',
      languageId: 'terminal-bash',
      supportsCompletion: true,
      supportsInlineDiagnostics: true,
      fallbackReason: null,
      contributions: [],
    };

    const { loadTerminalMonacoRuntime } = await loadRuntimeModule();

    const firstRuntime = await loadTerminalMonacoRuntime(capability);
    const secondRuntime = await loadTerminalMonacoRuntime(capability);

    expect(firstRuntime).toBe(secondRuntime);
    expect(firstRuntime.monaco.editor).toBe(monacoMock.editor);
    expect(firstRuntime.monaco.languages).toBe(monacoMock.languages);
    expect(firstRuntime.themeName).toBe('terminal-shell-enhanced');
    expect(monacoMock.editor.defineTheme).toHaveBeenCalledWith(
      'terminal-shell-enhanced',
      expect.objectContaining({
        base: 'vs',
        inherit: true,
      }),
    );
    expect(monacoMock.editor.setTheme).toHaveBeenCalledTimes(2);
    expect(monacoMock.languages.register).toHaveBeenCalledTimes(1);
    expect(monacoMock.languages.register).toHaveBeenCalledWith({
      id: 'terminal-bash',
    });
    expect(monacoMock.languages.setLanguageConfiguration).toHaveBeenCalledWith(
      'terminal-bash',
      expect.objectContaining({
        comments: { lineComment: '#' },
      }),
    );
    expect(monacoMock.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
      'terminal-bash',
      expect.objectContaining({
        tokenizer: expect.any(Object),
      }),
    );
    expect(monacoMock.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);

    const providerArgs =
      monacoMock.languages.registerCompletionItemProvider.mock.calls[0];
    expect(providerArgs[0]).toBe('terminal-bash');
    expect(providerArgs[1].triggerCharacters).toEqual(['$', '-']);
    const completions = providerArgs[1].provideCompletionItems(
      {
        getWordUntilPosition: () => ({
          startColumn: 2,
          endColumn: 4,
        }),
      },
      { lineNumber: 3 },
    );
    expect(completions.suggestions).toEqual([
      expect.objectContaining({
        label: 'export',
        kind: 'snippet-kind',
        insertTextRules: 'insert-as-snippet',
        range: {
          startLineNumber: 3,
          endLineNumber: 3,
          startColumn: 2,
          endColumn: 4,
        },
      }),
      expect.objectContaining({
        label: '$PROFILE',
        kind: 'keyword-kind',
      }),
    ]);

    const environment = (
      globalThis as typeof globalThis & {
        MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
      }
    ).MonacoEnvironment;
    expect(environment).toBeDefined();
    const worker = environment?.getWorker('worker-id', 'bash-worker');
    expect(worker).toBeInstanceOf(globalThis.Worker);
  });

  it('preserves an existing Monaco worker factory', async () => {
    const monacoMock = createMonacoMock();
    const existingWorkerFactory = jest.fn();
    jest.doMock('monaco-editor', () => monacoMock, { virtual: true });
    buildTerminalEditorCompletionItemsMock.mockReturnValue([]);
    (
      globalThis as typeof globalThis & {
        MonacoEnvironment?: { getWorker: typeof existingWorkerFactory };
      }
    ).MonacoEnvironment = {
      getWorker: existingWorkerFactory,
    };

    const { loadTerminalMonacoRuntime } = await loadRuntimeModule();

    await loadTerminalMonacoRuntime({
      mode: 'enhanced',
      enhancementLevel: 'enhanced',
      bundleId: 'shell-posix-vscode-compat',
      bundleLabel: 'POSIX Shell Essentials',
      languageId: 'terminal-zsh',
      supportsCompletion: true,
      supportsInlineDiagnostics: true,
      fallbackReason: null,
      contributions: [],
    });

    expect(
      (
        globalThis as typeof globalThis & {
          MonacoEnvironment?: { getWorker: typeof existingWorkerFactory };
        }
      ).MonacoEnvironment?.getWorker,
    ).toBe(existingWorkerFactory);
  });

  it('registers PowerShell tokens and skips completion setup for fallback capabilities', async () => {
    const monacoMock = createMonacoMock();
    jest.doMock('monaco-editor', () => monacoMock, { virtual: true });
    buildTerminalEditorCompletionItemsMock.mockReturnValue([]);

    const {
      loadTerminalMonacoRuntime,
    } = await loadRuntimeModule();

    await loadTerminalMonacoRuntime({
      mode: 'enhanced',
      enhancementLevel: 'enhanced',
      bundleId: 'powershell-profile-vscode-compat',
      bundleLabel: 'PowerShell Profile Essentials',
      languageId: 'terminal-powershell',
      supportsCompletion: true,
      supportsInlineDiagnostics: true,
      fallbackReason: null,
      contributions: [],
    });

    expect(monacoMock.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
      'terminal-powershell',
      expect.objectContaining({
        tokenizer: expect.any(Object),
      }),
    );
    expect(monacoMock.languages.registerCompletionItemProvider).not.toHaveBeenCalled();

    await loadTerminalMonacoRuntime({
      mode: 'fallback',
      enhancementLevel: 'basic',
      bundleId: null,
      bundleLabel: null,
      languageId: 'terminal-fish',
      supportsCompletion: false,
      supportsInlineDiagnostics: false,
      fallbackReason: 'fallback',
      contributions: [],
    });

    expect(monacoMock.languages.register).toHaveBeenCalledTimes(1);
  });

  it('creates Monaco markers with severity and location fallbacks', async () => {
    const monacoMock = createMonacoMock();
    jest.doMock('monaco-editor', () => monacoMock, { virtual: true });

    const { createDiagnosticMarkers } = await loadRuntimeModule();

    const markers = createDiagnosticMarkers(monacoMock as never, [
      {
        message: 'Invalid shell syntax',
        category: 'validation',
        location: {
          line: 4,
          column: 2,
          endLine: 4,
          endColumn: 8,
        },
      },
      {
        message: 'Minor suggestion',
        category: 'hint',
        location: null,
      },
    ]);

    expect(markers).toEqual([
      {
        message: 'Invalid shell syntax',
        severity: 8,
        startLineNumber: 4,
        startColumn: 2,
        endLineNumber: 4,
        endColumn: 8,
      },
      {
        message: 'Minor suggestion',
        severity: 4,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      },
    ]);
  });
});

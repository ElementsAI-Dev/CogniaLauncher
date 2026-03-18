import type {
  ShellType,
  TerminalConfigEditorCapability,
  TerminalEditorContribution,
  TerminalEditorLanguage,
} from '@/types/tauri';

export interface ResolveTerminalEditorCapabilityInput {
  shellType: ShellType;
  configPath: string;
  language: TerminalEditorLanguage;
}

export interface TerminalEditorCompletionItem {
  label: string;
  detail: string;
  insertText: string;
  insertTextRules: 'plain' | 'snippet';
  kind: 'keyword' | 'snippet';
}

function buildContribution(
  id: string,
  label: string,
  kind: TerminalEditorContribution['kind'],
  enabled: boolean,
  reason: string | null = null,
): TerminalEditorContribution {
  return {
    id,
    label,
    kind,
    source: 'vscode-compatible',
    enabled,
    reason,
  };
}

function createEnhancedCapability(
  bundleId: string,
  bundleLabel: string,
  languageId: string,
  contributions: TerminalEditorContribution[],
): TerminalConfigEditorCapability {
  return {
    mode: 'enhanced',
    enhancementLevel: 'enhanced',
    bundleId,
    bundleLabel,
    languageId,
    supportsCompletion: true,
    supportsInlineDiagnostics: true,
    fallbackReason: null,
    contributions,
  };
}

function createFallbackCapability(
  languageId: string,
  fallbackReason: string,
  contributionId: string,
  contributionLabel: string,
): TerminalConfigEditorCapability {
  return {
    mode: 'fallback',
    enhancementLevel: 'basic',
    bundleId: null,
    bundleLabel: null,
    languageId,
    supportsCompletion: false,
    supportsInlineDiagnostics: false,
    fallbackReason,
    contributions: [
      buildContribution(
        contributionId,
        contributionLabel,
        'grammar',
        false,
        fallbackReason,
      ),
    ],
  };
}

export function resolveTerminalEditorCapability({
  shellType,
}: ResolveTerminalEditorCapabilityInput): TerminalConfigEditorCapability {
  switch (shellType) {
    case 'bash':
    case 'zsh':
      return createEnhancedCapability(
        'shell-posix-vscode-compat',
        'POSIX Shell Essentials',
        `terminal-${shellType}`,
        [
          buildContribution('shell-posix-grammar', 'POSIX shell grammar', 'grammar', true),
          buildContribution(
            'shell-posix-language-config',
            'POSIX shell language configuration',
            'language-configuration',
            true,
          ),
          buildContribution('shell-posix-snippets', 'POSIX shell snippets', 'snippets', true),
          buildContribution('shell-posix-completion', 'POSIX shell completions', 'completion', true),
          buildContribution('shell-posix-diagnostics', 'Inline diagnostics projection', 'diagnostics', true),
        ],
      );
    case 'powershell':
      return createEnhancedCapability(
        'powershell-profile-vscode-compat',
        'PowerShell Profile Essentials',
        'terminal-powershell',
        [
          buildContribution('powershell-grammar', 'PowerShell grammar', 'grammar', true),
          buildContribution(
            'powershell-language-config',
            'PowerShell language configuration',
            'language-configuration',
            true,
          ),
          buildContribution('powershell-snippets', 'PowerShell profile snippets', 'snippets', true),
          buildContribution('powershell-completion', 'PowerShell profile completions', 'completion', true),
          buildContribution('powershell-diagnostics', 'Inline diagnostics projection', 'diagnostics', true),
        ],
      );
    case 'fish':
      return createFallbackCapability(
        'terminal-fish',
        'Fish fallback is active until a curated web-safe bundle is added.',
        'fish-vscode-preview',
        'Fish VS Code compatibility preview',
      );
    case 'cmd':
      return createFallbackCapability(
        'terminal-cmd',
        'Cmd fallback is active because no curated VS Code-compatible bundle is registered for cmd scripts.',
        'cmd-vscode-preview',
        'Cmd VS Code compatibility preview',
      );
    case 'nushell':
      return createFallbackCapability(
        'terminal-nushell',
        'Nushell fallback is active until a curated web-safe bundle is added.',
        'nushell-vscode-preview',
        'Nushell VS Code compatibility preview',
      );
    default:
      return createFallbackCapability(
        'terminal-plaintext',
        'Fallback editor is active because no compatible enhancement bundle was resolved.',
        'terminal-unknown-preview',
        'Unknown shell compatibility preview',
      );
  }
}

export function buildTerminalEditorCompletionItems(
  capability: TerminalConfigEditorCapability,
): TerminalEditorCompletionItem[] {
  if (capability.mode !== 'enhanced') {
    return [];
  }

  if (capability.bundleId === 'powershell-profile-vscode-compat') {
    return [
      {
        label: 'Set-Item',
        detail: 'PowerShell command',
        insertText: 'Set-Item -Path ${1:Env:NAME} -Value ${2:value}',
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
      {
        label: 'function',
        detail: 'PowerShell function snippet',
        insertText: 'function ${1:Name} {\n  ${2:Write-Host "Hello"}\n}',
        insertTextRules: 'snippet',
        kind: 'snippet',
      },
    ];
  }

  return [
    {
      label: 'export',
      detail: 'Shell export snippet',
      insertText: 'export ${1:NAME}="${2:value}"',
      insertTextRules: 'snippet',
      kind: 'snippet',
    },
    {
      label: 'alias',
      detail: 'Shell alias snippet',
      insertText: 'alias ${1:name}="${2:command}"',
      insertTextRules: 'snippet',
      kind: 'snippet',
    },
    {
      label: 'source',
      detail: 'Shell source command',
      insertText: 'source ${1:~/.bashrc}',
      insertTextRules: 'snippet',
      kind: 'snippet',
    },
  ];
}

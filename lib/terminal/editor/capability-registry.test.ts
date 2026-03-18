import {
  buildTerminalEditorCompletionItems,
  resolveTerminalEditorCapability,
} from './capability-registry';

describe('resolveTerminalEditorCapability', () => {
  it('returns an enhanced curated bundle for bash config targets', () => {
    const capability = resolveTerminalEditorCapability({
      shellType: 'bash',
      configPath: '/home/user/.bashrc',
      language: 'bash',
    });

    expect(capability.mode).toBe('enhanced');
    expect(capability.bundleId).toBe('shell-posix-vscode-compat');
    expect(capability.supportsCompletion).toBe(true);
    expect(capability.supportsInlineDiagnostics).toBe(true);
    expect(capability.contributions.some((item) => item.enabled && item.kind === 'snippets')).toBe(true);
  });

  it('returns a fallback capability with an explicit compatibility reason for fish targets', () => {
    const capability = resolveTerminalEditorCapability({
      shellType: 'fish',
      configPath: '/home/user/.config/fish/config.fish',
      language: 'bash',
    });

    expect(capability.mode).toBe('fallback');
    expect(capability.bundleId).toBeNull();
    expect(capability.fallbackReason).toMatch(/Fish/i);
    expect(capability.contributions.some((item) => item.enabled === false)).toBe(true);
  });
});

describe('buildTerminalEditorCompletionItems', () => {
  it('builds curated completions and snippets for supported bundles', () => {
    const capability = resolveTerminalEditorCapability({
      shellType: 'bash',
      configPath: '/home/user/.bashrc',
      language: 'bash',
    });

    const items = buildTerminalEditorCompletionItems(capability);

    expect(items.map((item) => item.label)).toEqual(
      expect.arrayContaining(['export', 'alias', 'source']),
    );
    expect(items.some((item) => item.insertText.includes('${1:'))).toBe(true);
  });

  it('returns no completion items when the target is fallback-only', () => {
    const capability = resolveTerminalEditorCapability({
      shellType: 'fish',
      configPath: '/home/user/.config/fish/config.fish',
      language: 'bash',
    });

    expect(buildTerminalEditorCompletionItems(capability)).toEqual([]);
  });
});

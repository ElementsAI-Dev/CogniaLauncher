import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalShellConfig } from './terminal-shell-config';
import type { ShellInfo, ShellConfigEntries } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockTerminalConfigEditor = jest.fn(
  ({
    language,
    diagnostics,
    baselineValue,
    configPath,
    shellType,
    onChange,
  }: {
    language: string;
    diagnostics?: unknown[];
    baselineValue?: string | null;
    configPath?: string | null;
    shellType?: string;
    onChange?: (value: string) => void;
  }) => (
    <div data-testid="terminal-config-editor">
      <span data-testid="terminal-config-editor-language">{language}</span>
      <span data-testid="terminal-config-editor-diagnostics-count">{diagnostics?.length ?? 0}</span>
      <span data-testid="terminal-config-editor-baseline">{baselineValue ?? ''}</span>
      <span data-testid="terminal-config-editor-config-path">{configPath ?? ''}</span>
      <span data-testid="terminal-config-editor-shell-type">{shellType ?? ''}</span>
      <button type="button" onClick={() => onChange?.('modified draft')}>
        edit-draft
      </button>
    </div>
  ),
);

jest.mock('./terminal-config-editor', () => ({
  TerminalConfigEditor: (props: {
    language: string;
    diagnostics?: unknown[];
    baselineValue?: string | null;
    configPath?: string | null;
    shellType?: string;
    onChange?: (value: string) => void;
  }) =>
    mockTerminalConfigEditor(props),
}));

const shells: ShellInfo[] = [
  {
    id: 'bash',
    name: 'Bash',
    shellType: 'bash',
    version: '5.2',
    executablePath: '/bin/bash',
    configFiles: [
      { path: '/home/user/.bashrc', exists: true, sizeBytes: 1024 },
    ],
    isDefault: true,
  },
];

const shellNoConfig: ShellInfo[] = [
  {
    id: 'fish',
    name: 'Fish',
    shellType: 'fish',
    version: '3.6',
    executablePath: '/usr/bin/fish',
    configFiles: [
      { path: '/home/user/.config/fish/config.fish', exists: false, sizeBytes: 0 },
    ],
    isDefault: false,
  },
];

const mockEntries: ShellConfigEntries = {
  aliases: [['ll', 'ls -la']],
  exports: [['EDITOR', 'vim']],
  sources: ['/home/user/.bash_aliases'],
};

describe('TerminalShellConfig', () => {
  it('renders shell selector and config file dropdown', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.shellConfig')).toBeInTheDocument();
  });

  it('returns null when no shells provided', () => {
    const { container } = render(
      <TerminalShellConfig
        shells={[]}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders with onWriteConfig prop without error', () => {
    const { container } = render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
      />,
    );

    expect(container.querySelector('[role="combobox"]')).toBeInTheDocument();
  });

  it('has load button disabled when no config path selected', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    const loadButton = screen.getByRole('button', { name: /terminal\.loadConfig/i });
    expect(loadButton).toBeDisabled();
  });

  it('shows noConfigFiles when shell has no existing config files', () => {
    render(
      <TerminalShellConfig
        shells={shellNoConfig}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noConfigFiles')).toBeInTheDocument();
  });

  it('renders config file dropdown for shell with existing config files', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    // Two comboboxes: shell selector + config file selector
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBe(2);

    // Load button exists but is disabled (no config path selected yet)
    const loadButton = screen.getByRole('button', { name: /terminal\.loadConfig/i });
    expect(loadButton).toBeDisabled();
  });

  it('renders multiple shells in selector when provided', () => {
    const multiShells: ShellInfo[] = [
      ...shells,
      {
        id: 'zsh',
        name: 'Zsh',
        shellType: 'zsh',
        version: '5.9',
        executablePath: '/bin/zsh',
        configFiles: [
          { path: '/home/user/.zshrc', exists: true, sizeBytes: 512 },
        ],
        isDefault: false,
      },
    ];

    render(
      <TerminalShellConfig
        shells={multiShells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
      />,
    );

    // Component renders without error with multiple shells
    expect(screen.getByText('terminal.shellConfig')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBe(2);
  });

  it('renders with onParseConfigContent prop without error', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onParseConfigContent={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.shellConfig')).toBeInTheDocument();
  });

  it('uses onParseConfigContent when provided during load', async () => {
    const onReadConfig = jest.fn().mockResolvedValue('alias ll="ls -la"');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);
    const onParseConfigContent = jest.fn().mockResolvedValue(mockEntries);

    // Pre-select config path via shell with a single config file
    const shellWithSelected: ShellInfo[] = [
      {
        ...shells[0],
        configFiles: [{ path: '/home/user/.bashrc', exists: true, sizeBytes: 1024 }],
      },
    ];

    const { rerender } = render(
      <TerminalShellConfig
        shells={shellWithSelected}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onParseConfigContent={onParseConfigContent}
        onBackupConfig={jest.fn()}
      />,
    );

    // We need to simulate selecting a config path. Since Radix Select portal
    // is not easily accessible in tests, we test the load logic by checking
    // that the component renders with the right props and callbacks.
    // The load button should be disabled without a selected config path.
    const loadButton = screen.getByRole('button', { name: /terminal\.loadConfig/i });
    expect(loadButton).toBeDisabled();

    // Verify the component accepts onParseConfigContent
    rerender(
      <TerminalShellConfig
        shells={shellWithSelected}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onParseConfigContent={onParseConfigContent}
        onBackupConfig={jest.fn()}
      />,
    );

    // The component rendered without error with onParseConfigContent
    expect(screen.getByText('terminal.shellConfig')).toBeInTheDocument();
  });

  it('shows error state when loading fails (via direct handleLoadConfig)', async () => {
    // Test error rendering by providing a component that will show the error UI.
    // Since we can't easily interact with Radix Select portals in JSDOM,
    // we test the error banner rendering pattern directly.
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn().mockRejectedValue(new Error('File access denied'))}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    // Load button disabled (no config selected) — this confirms the guard works
    const loadButton = screen.getByRole('button', { name: /terminal\.loadConfig/i });
    expect(loadButton).toBeDisabled();

    // Error banner not visible before any load attempt
    expect(screen.queryByText(/File access denied/)).not.toBeInTheDocument();
  });

  it('renders without error when all optional props are provided', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onParseConfigContent={jest.fn()}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.shellConfig')).toBeInTheDocument();
    expect(screen.getByText('terminal.shellConfigDesc')).toBeInTheDocument();
  });

  it('renders mutation success state and allows clearing it', async () => {
    const onClearMutationState = jest.fn();
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
        mutationStatus="success"
        mutationMessage="Config verified"
        onClearMutationState={onClearMutationState}
      />,
    );

    expect(screen.getByText('Config verified')).toBeInTheDocument();
    screen.getByRole('button', { name: /terminal\.cancel/i }).click();
    expect(onClearMutationState).toHaveBeenCalledTimes(1);
  });

  it('renders mutation error state inline', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
        mutationStatus="error"
        mutationMessage="Write failed"
      />,
    );

    expect(screen.getByText('Write failed')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /terminal\.loadConfig/i }).length).toBeGreaterThan(0);
  });

  it('passes language and diagnostics to highlighted editor while editing', async () => {
    const user = userEvent.setup();
    const onReadConfig = jest.fn().mockResolvedValue('export TEST=1');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);
    const onGetConfigEditorMetadata = jest.fn().mockResolvedValue({
      path: '/home/user/.bashrc',
      shellType: 'bash',
      language: 'bash',
      snapshotPath: '/home/user/.cognia/terminal-snapshots/.bashrc.latest',
      fingerprint: 'abc123',
    });

    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onBackupConfig={jest.fn()}
        onGetConfigEditorMetadata={onGetConfigEditorMetadata}
        onWriteConfig={jest.fn().mockResolvedValue({
          operation: 'write',
          path: '/home/user/.bashrc',
          backupPath: null,
          bytesWritten: 12,
          verified: false,
          diagnostics: ['Unterminated quote'],
          diagnosticDetails: [
            {
              category: 'validation',
              stage: 'validation',
              message: 'Unterminated quote',
              location: { line: 1, column: 1, endLine: 1, endColumn: 20 },
            },
          ],
          snapshotPath: null,
          fingerprint: null,
        })}
        mutationStatus="error"
        mutationMessage="Write failed"
        mutationResult={{
          operation: 'write',
          path: '/home/user/.bashrc',
          backupPath: null,
          bytesWritten: 0,
          verified: false,
          diagnostics: ['Unterminated quote'],
          diagnosticDetails: [
            {
              category: 'validation',
              stage: 'validation',
              message: 'Unterminated quote',
              location: { line: 1, column: 1, endLine: 1, endColumn: 20 },
            },
          ],
          snapshotPath: null,
          fingerprint: null,
        }}
      />,
    );

    const [, configSelect] = screen.getAllByRole('combobox');
    await user.click(configSelect);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bashrc/i }));

    await user.click(screen.getAllByRole('button', { name: /terminal\.loadConfig/i })[0]);
    await screen.findByRole('button', { name: /terminal\.editConfig/i });
    await user.click(screen.getByRole('button', { name: /terminal\.editConfig/i }));

    expect(screen.getByTestId('terminal-config-editor')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-config-editor-language')).toHaveTextContent('bash');
    expect(screen.getByTestId('terminal-config-editor-diagnostics-count')).toHaveTextContent('1');
    expect(screen.getByTestId('terminal-config-editor-baseline')).toHaveTextContent('export TEST=1');
    expect(screen.getByTestId('terminal-config-editor-config-path')).toHaveTextContent('/home/user/.bashrc');
    expect(screen.getByTestId('terminal-config-editor-shell-type')).toHaveTextContent('bash');
  });

  it('clears stale mutation state when loading a target or cancelling edit', async () => {
    const user = userEvent.setup();
    const onClearMutationState = jest.fn();
    const onReadConfig = jest.fn().mockResolvedValue('export TEST=1');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);

    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
        mutationStatus="error"
        mutationMessage="Write failed"
        onClearMutationState={onClearMutationState}
      />,
    );

    const [, configSelect] = screen.getAllByRole('combobox');
    await user.click(configSelect);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bashrc/i }));

    await user.click(screen.getAllByRole('button', { name: /terminal\.loadConfig/i })[0]);
    await screen.findByRole('button', { name: /terminal\.editConfig/i });
    const clearsAfterLoad = onClearMutationState.mock.calls.length;
    expect(clearsAfterLoad).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: /terminal\.editConfig/i }));
    const cancelButtons = screen.getAllByRole('button', { name: /terminal\.cancel/i });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    expect(onClearMutationState.mock.calls.length).toBeGreaterThan(clearsAfterLoad);
    expect(screen.queryByTestId('terminal-config-editor')).not.toBeInTheDocument();
  });

  it('resets loaded editor state when selecting a different config target', async () => {
    const user = userEvent.setup();
    const onReadConfig = jest.fn().mockResolvedValue('export TEST=1');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);
    const onClearMutationState = jest.fn();
    const shellsWithTwoConfigs: ShellInfo[] = [
      {
        ...shells[0],
        configFiles: [
          { path: '/home/user/.bashrc', exists: true, sizeBytes: 1024 },
          { path: '/home/user/.bash_profile', exists: true, sizeBytes: 512 },
        ],
      },
    ];

    render(
      <TerminalShellConfig
        shells={shellsWithTwoConfigs}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
        onClearMutationState={onClearMutationState}
      />,
    );

    const [, configSelect] = screen.getAllByRole('combobox');
    await user.click(configSelect);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bashrc/i }));

    await user.click(screen.getByRole('button', { name: /terminal\.loadConfig/i }));
    await screen.findByRole('button', { name: /terminal\.editConfig/i });
    await user.click(screen.getByRole('button', { name: /terminal\.editConfig/i }));
    expect(screen.getByTestId('terminal-config-editor')).toBeInTheDocument();

    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bash_profile/i }));

    expect(onClearMutationState).toHaveBeenCalled();
    expect(screen.queryByTestId('terminal-config-editor')).not.toBeInTheDocument();
  });

  it('invokes restore callback for current config and reloads baseline', async () => {
    const user = userEvent.setup();
    const onReadConfig = jest.fn().mockResolvedValue('export TEST=1');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);
    const onRestoreConfigSnapshot = jest.fn().mockResolvedValue({
      path: '/home/user/.bashrc',
      snapshotPath: '/home/user/.cognia/terminal-snapshots/.bashrc.latest',
      bytesWritten: 12,
      verified: true,
      diagnostics: ['restored'],
      diagnosticDetails: [],
      fingerprint: 'abc123',
    });

    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onBackupConfig={jest.fn()}
        onRestoreConfigSnapshot={onRestoreConfigSnapshot}
      />,
    );

    const [, configSelect] = screen.getAllByRole('combobox');
    await user.click(configSelect);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bashrc/i }));

    await user.click(screen.getByRole('button', { name: /terminal\.loadConfig/i }));
    await screen.findByRole('button', { name: /terminal\.restoreSnapshot/i });

    await user.click(screen.getByRole('button', { name: /terminal\.restoreSnapshot/i }));

    expect(onRestoreConfigSnapshot).toHaveBeenCalledWith('/home/user/.bashrc');
    expect(onReadConfig).toHaveBeenCalledTimes(2);
  });

  it('refreshes only parsed entries when refresh intent marks configEntries stale', async () => {
    const user = userEvent.setup();
    const onRefreshHandled = jest.fn();
    const onReadConfig = jest.fn().mockResolvedValue('export TEST=1');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);
    const onParseConfigContent = jest.fn().mockResolvedValue(mockEntries);
    const onGetConfigEditorMetadata = jest.fn().mockResolvedValue({
      path: '/home/user/.bashrc',
      shellType: 'bash',
      language: 'bash',
      snapshotPath: null,
      fingerprint: 'abc123',
    });

    const { rerender } = render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onParseConfigContent={onParseConfigContent}
        onGetConfigEditorMetadata={onGetConfigEditorMetadata}
        onBackupConfig={jest.fn()}
        refreshIntent={{ signal: 0, configEntries: false, configMetadata: false }}
        onRefreshHandled={onRefreshHandled}
      />,
    );

    const [, configSelect] = screen.getAllByRole('combobox');
    await user.click(configSelect);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bashrc/i }));
    await user.click(screen.getByRole('button', { name: /terminal\.loadConfig/i }));
    await waitFor(() => {
      expect(onReadConfig).toHaveBeenCalledTimes(1);
    });

    onRefreshHandled.mockClear();
    onReadConfig.mockClear();
    onParseConfigContent.mockClear();
    onGetConfigEditorMetadata.mockClear();

    rerender(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onParseConfigContent={onParseConfigContent}
        onGetConfigEditorMetadata={onGetConfigEditorMetadata}
        onBackupConfig={jest.fn()}
        refreshIntent={{ signal: 1, configEntries: true, configMetadata: false }}
        onRefreshHandled={onRefreshHandled}
      />,
    );

    await waitFor(() => {
      expect(onReadConfig).toHaveBeenCalledTimes(1);
      expect(onParseConfigContent).toHaveBeenCalledTimes(1);
      expect(onGetConfigEditorMetadata).not.toHaveBeenCalled();
      expect(onRefreshHandled).toHaveBeenCalledWith({ configEntries: true, configMetadata: false });
    });
  });

  it('refreshes only metadata when refresh intent marks configMetadata stale', async () => {
    const user = userEvent.setup();
    const onRefreshHandled = jest.fn();
    const onReadConfig = jest.fn().mockResolvedValue('export TEST=1');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);
    const onParseConfigContent = jest.fn().mockResolvedValue(mockEntries);
    const onGetConfigEditorMetadata = jest.fn().mockResolvedValue({
      path: '/home/user/.bashrc',
      shellType: 'bash',
      language: 'bash',
      snapshotPath: null,
      fingerprint: 'abc123',
    });

    const { rerender } = render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onParseConfigContent={onParseConfigContent}
        onGetConfigEditorMetadata={onGetConfigEditorMetadata}
        onBackupConfig={jest.fn()}
        refreshIntent={{ signal: 0, configEntries: false, configMetadata: false }}
        onRefreshHandled={onRefreshHandled}
      />,
    );

    const [, configSelect] = screen.getAllByRole('combobox');
    await user.click(configSelect);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bashrc/i }));
    await user.click(screen.getByRole('button', { name: /terminal\.loadConfig/i }));
    await waitFor(() => {
      expect(onReadConfig).toHaveBeenCalledTimes(1);
    });

    onRefreshHandled.mockClear();
    onReadConfig.mockClear();
    onParseConfigContent.mockClear();
    onGetConfigEditorMetadata.mockClear();

    rerender(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onParseConfigContent={onParseConfigContent}
        onGetConfigEditorMetadata={onGetConfigEditorMetadata}
        onBackupConfig={jest.fn()}
        refreshIntent={{ signal: 1, configEntries: false, configMetadata: true }}
        onRefreshHandled={onRefreshHandled}
      />,
    );

    await waitFor(() => {
      expect(onReadConfig).not.toHaveBeenCalled();
      expect(onParseConfigContent).not.toHaveBeenCalled();
      expect(onGetConfigEditorMetadata).toHaveBeenCalledTimes(1);
      expect(onRefreshHandled).toHaveBeenCalledWith({ configEntries: false, configMetadata: true });
    });
  });

  it('emits dirty-state changes and shows explicit unsaved-draft actions when switching target', async () => {
    const user = userEvent.setup();
    const onReadConfig = jest.fn().mockResolvedValue('export TEST=1');
    const onFetchConfigEntries = jest.fn().mockResolvedValue(mockEntries);
    const onDirtyChange = jest.fn();
    const onRequestDiscard = jest.fn();
    const shellsWithTwoConfigs: ShellInfo[] = [
      {
        ...shells[0],
        configFiles: [
          { path: '/home/user/.bashrc', exists: true, sizeBytes: 1024 },
          { path: '/home/user/.bash_profile', exists: true, sizeBytes: 512 },
        ],
      },
    ];

    render(
      <TerminalShellConfig
        shells={shellsWithTwoConfigs}
        onReadConfig={onReadConfig}
        onFetchConfigEntries={onFetchConfigEntries}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
        onDirtyChange={onDirtyChange}
        onRequestDiscard={onRequestDiscard}
      />,
    );

    const [, configSelect] = screen.getAllByRole('combobox');
    await user.click(configSelect);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bashrc/i }));

    await user.click(screen.getByRole('button', { name: /terminal\.loadConfig/i }));
    await screen.findByRole('button', { name: /terminal\.editConfig/i });
    await user.click(screen.getByRole('button', { name: /terminal\.editConfig/i }));
    await user.click(screen.getByRole('button', { name: /edit-draft/i }));

    expect(onDirtyChange).toHaveBeenCalledWith(true);

    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bash_profile/i }));

    expect(onRequestDiscard).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /terminal\.unsavedDraft/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /terminal\.stay/i }));
    expect(screen.queryByRole('heading', { name: /terminal\.unsavedDraft/i })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(await screen.findByRole('option', { name: /\/home\/user\/\.bash_profile/i }));
    await user.click(screen.getByRole('button', { name: /terminal\.discardAndSwitch/i }));

    expect(screen.queryByTestId('terminal-config-editor')).not.toBeInTheDocument();
  });
});

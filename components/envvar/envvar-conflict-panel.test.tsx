import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarConflictPanel } from './envvar-conflict-panel';
import type { EnvVarConflict } from '@/types/tauri';

const CUSTOM_IGNORED_STORAGE_KEY = 'envvar.customIgnoredConflictKeys';

const mockT = (key: string, params?: Record<string, string | number>) => {
  switch (key) {
    case 'envvar.conflicts.title':
      return 'Conflicts';
    case 'envvar.conflicts.restore':
      return 'Restore conflicts';
    case 'envvar.conflicts.noConflicts':
      return 'No conflicts';
    case 'envvar.conflicts.show':
      return 'Show conflicts';
    case 'envvar.conflicts.hide':
      return 'Hide conflicts';
    case 'envvar.conflicts.dismiss':
      return 'Dismiss conflicts';
    case 'envvar.conflicts.ignoreDefaults':
      return `Defaults: ${params?.keys ?? ''}`;
    case 'envvar.conflicts.ignorePlaceholder':
      return 'Add custom ignore keys';
    case 'envvar.conflicts.ignoreAdd':
      return 'Add ignore key';
    case 'envvar.conflicts.hiddenByIgnore':
      return `Hidden by ignore: ${params?.count ?? 0}`;
    case 'envvar.conflicts.description':
      return `Showing ${params?.count ?? 0} conflicts`;
    case 'envvar.conflicts.applyUserToSystem':
      return 'Apply user to system';
    case 'envvar.conflicts.applySystemToUser':
      return 'Apply system to user';
    case 'common.delete':
      return 'Delete';
    case 'envvar.conflicts.review':
      return 'Review';
    case 'common.clear':
      return 'Clear';
    default:
      return key;
  }
};

const buildConflict = (overrides: Partial<EnvVarConflict> = {}): EnvVarConflict => ({
  key: 'JAVA_HOME',
  userValue: 'C:\\Users\\dev\\jdk',
  systemValue: 'C:\\Program Files\\Java\\jdk',
  effectiveValue: 'C:\\Users\\dev\\jdk',
  ...overrides,
});

describe('EnvVarConflictPanel', () => {
  const originalInnerWidth = window.innerWidth;
  const defaultProps = {
    conflicts: [buildConflict()],
    onResolve: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('filters default ignored keys and renders the desktop conflict table', async () => {
    render(
      <EnvVarConflictPanel
        {...defaultProps}
        conflicts={[buildConflict({ key: 'PATH' }), buildConflict()]}
      />,
    );

    expect(screen.getByTestId('envvar-conflicts-summary')).toBeInTheDocument();
    expect(screen.getByTestId('envvar-conflicts-count')).toHaveTextContent('1');

    // Panel starts collapsed — expand it
    await userEvent.click(screen.getByTestId('envvar-conflicts-review'));

    expect(screen.getByTestId('envvar-conflicts-table')).toBeInTheDocument();
    expect(screen.getByTestId('envvar-conflicts-hidden-count')).toHaveTextContent(
      'Hidden by ignore: 1',
    );
    expect(screen.queryByTestId('envvar-conflict-user-to-system-PATH')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('envvar-conflict-user-to-system-JAVA_HOME'),
    ).toBeInTheDocument();
  });

  it('adds and removes custom ignored keys with normalized persistence', async () => {
    render(<EnvVarConflictPanel {...defaultProps} />);

    // Expand the collapsed panel
    await userEvent.click(screen.getByTestId('envvar-conflicts-review'));

    await userEvent.type(
      screen.getByTestId('envvar-conflicts-ignore-input'),
      ' java_home {Enter}',
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(CUSTOM_IGNORED_STORAGE_KEY)).toBe('["JAVA_HOME"]');
    });

    expect(screen.getByText('No conflicts')).toBeInTheDocument();
    expect(screen.getByTestId('envvar-conflicts-hidden-count')).toHaveTextContent(
      'Hidden by ignore: 1',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete JAVA_HOME' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(CUSTOM_IGNORED_STORAGE_KEY)).toBe('[]');
      expect(
        screen.getByTestId('envvar-conflict-user-to-system-JAVA_HOME'),
      ).toBeInTheDocument();
    });
  });

  it('clears duplicate or default ignore input without persisting a new custom key', async () => {
    render(<EnvVarConflictPanel {...defaultProps} />);

    await userEvent.click(screen.getByTestId('envvar-conflicts-review'));

    const input = screen.getByTestId('envvar-conflicts-ignore-input');

    await userEvent.type(input, 'PATH{Enter}');

    expect(input).toHaveValue('');
    expect(window.localStorage.getItem(CUSTOM_IGNORED_STORAGE_KEY)).toBeNull();

    await userEvent.type(input, 'JAVA_HOME{Enter}');

    await waitFor(() => {
      expect(window.localStorage.getItem(CUSTOM_IGNORED_STORAGE_KEY)).toBe('["JAVA_HOME"]');
    });

    await userEvent.type(input, 'java_home{Enter}');

    expect(input).toHaveValue('');
    expect(window.localStorage.getItem(CUSTOM_IGNORED_STORAGE_KEY)).toBe('["JAVA_HOME"]');
  });

  it('ignores whitespace-only custom ignore input', async () => {
    render(<EnvVarConflictPanel {...defaultProps} />);

    await userEvent.click(screen.getByTestId('envvar-conflicts-review'));

    const input = screen.getByTestId('envvar-conflicts-ignore-input');

    await userEvent.type(input, '   {Enter}');

    expect(input).toHaveValue('   ');
    expect(window.localStorage.getItem(CUSTOM_IGNORED_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('envvar-conflict-user-to-system-JAVA_HOME')).toBeInTheDocument();
  });

  it('restores persisted custom ignored keys and clears them', async () => {
    window.localStorage.setItem(CUSTOM_IGNORED_STORAGE_KEY, '["NODE_HOME"]');

    render(
      <EnvVarConflictPanel
        {...defaultProps}
        conflicts={[buildConflict({ key: 'NODE_HOME' })]}
      />,
    );

    // No visible conflicts (NODE_HOME is ignored) so no Review button — use toggle
    await userEvent.click(screen.getByTestId('envvar-conflicts-toggle'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete NODE_HOME' })).toBeInTheDocument();
    });

    expect(screen.getByText('No conflicts')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('envvar-conflicts-ignore-clear'));

    await waitFor(() => {
      expect(window.localStorage.getItem(CUSTOM_IGNORED_STORAGE_KEY)).toBe('[]');
      expect(
        screen.getByTestId('envvar-conflict-user-to-system-NODE_HOME'),
      ).toBeInTheDocument();
    });
  });

  it('dismisses and restores the panel with the remaining conflict count', async () => {
    render(<EnvVarConflictPanel {...defaultProps} />);

    await userEvent.click(screen.getByTestId('envvar-conflicts-dismiss'));

    const restoreButton = screen.getByTestId('envvar-conflicts-restore');
    expect(restoreButton).toHaveTextContent('Restore conflicts');
    expect(restoreButton).toHaveTextContent('1');

    await userEvent.click(restoreButton);

    expect(screen.getByTestId('envvar-conflicts-summary')).toBeInTheDocument();
  });

  it('toggles collapsed state and respects the busy desktop resolve actions', async () => {
    const onResolve = jest.fn();
    const { rerender } = render(
      <EnvVarConflictPanel {...defaultProps} onResolve={onResolve} />,
    );

    // Expand the collapsed panel first
    await userEvent.click(screen.getByTestId('envvar-conflicts-review'));

    await userEvent.click(screen.getByTestId('envvar-conflict-user-to-system-JAVA_HOME'));
    await userEvent.click(screen.getByTestId('envvar-conflict-system-to-user-JAVA_HOME'));

    expect(onResolve).toHaveBeenNthCalledWith(1, 'JAVA_HOME', 'user', 'system');
    expect(onResolve).toHaveBeenNthCalledWith(2, 'JAVA_HOME', 'system', 'user');

    rerender(<EnvVarConflictPanel {...defaultProps} onResolve={onResolve} busy />);

    expect(screen.getByTestId('envvar-conflict-user-to-system-JAVA_HOME')).toBeDisabled();

    await userEvent.click(screen.getByTestId('envvar-conflicts-toggle'));

    expect(screen.getByTestId('envvar-conflicts-toggle')).toHaveAttribute(
      'aria-label',
      'Show conflicts',
    );
  });

  it('renders a compact layout on small screens and resolves system values back to user scope', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 640,
    });

    const onResolve = jest.fn();
    render(<EnvVarConflictPanel {...defaultProps} onResolve={onResolve} />);

    // Expand the collapsed panel
    await userEvent.click(screen.getByTestId('envvar-conflicts-review'));

    await waitFor(() => {
      expect(screen.getByTestId('envvar-conflicts-compact-list')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('envvar-conflict-system-to-user-JAVA_HOME'));

    expect(onResolve).toHaveBeenCalledWith('JAVA_HOME', 'system', 'user');
  });

  it('keeps local ignore state working when localStorage persistence fails', async () => {
    const setItemMock = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    try {
      render(<EnvVarConflictPanel {...defaultProps} />);

      // Expand the collapsed panel
      await userEvent.click(screen.getByTestId('envvar-conflicts-review'));

      await userEvent.type(
        screen.getByTestId('envvar-conflicts-ignore-input'),
        'JAVA_HOME{Enter}',
      );

      await waitFor(() => {
        expect(screen.getByText('No conflicts')).toBeInTheDocument();
      });
    } finally {
      setItemMock.mockRestore();
    }
  });

  it('ignores malformed persisted state and still renders an empty conflict state', () => {
    window.localStorage.setItem(CUSTOM_IGNORED_STORAGE_KEY, '{bad json');

    render(<EnvVarConflictPanel {...defaultProps} conflicts={[]} />);

    expect(screen.getAllByText('No conflicts').length).toBeGreaterThanOrEqual(1);
  });
});

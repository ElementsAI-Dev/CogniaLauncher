import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarTable } from './envvar-table';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'envvar.table.key': 'Key',
    'envvar.table.value': 'Value',
    'envvar.table.scope': 'Scope',
    'envvar.table.search': 'Search...',
    'envvar.table.noResults': 'No results found',
    'envvar.table.noPersistentVars': 'No persistent variables',
    'envvar.table.copied': 'Copied',
    'envvar.scopes.process': 'Process',
    'envvar.scopes.user': 'User',
    'envvar.scopes.system': 'System',
    'envvar.actions.edit': 'Edit',
    'envvar.actions.delete': 'Delete',
    'envvar.table.copy': 'Copy value',
    'envvar.confirm.deleteTitle': 'Delete Environment Variable',
    'envvar.confirm.deleteDesc': 'Are you sure?',
    'envvar.conflicts.title': 'Conflict',
    'common.cancel': 'Cancel',
  };
  return translations[key] || key;
};

const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

describe('EnvVarTable', () => {
  const baseRows = [
    { key: 'PATH', value: '/usr/local/bin:/usr/bin', scope: 'process' as const },
    { key: 'HOME', value: '/home/user', scope: 'process' as const },
    { key: 'LANG', value: 'en_US.UTF-8', scope: 'process' as const },
  ];

  const defaultProps = {
    rows: baseRows,
    scopeFilter: 'all' as const,
    searchQuery: '',
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders table headers', () => {
    render(<EnvVarTable {...defaultProps} />);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
  });

  it('renders all env var rows', () => {
    render(<EnvVarTable {...defaultProps} />);
    expect(screen.getByText('PATH')).toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.getByText('LANG')).toBeInTheDocument();
  });

  it('filters by search query on key', () => {
    render(<EnvVarTable {...defaultProps} searchQuery="path" />);
    expect(screen.getByText('PATH')).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
    expect(screen.queryByText('LANG')).not.toBeInTheDocument();
  });

  it('filters by search query on value', () => {
    render(<EnvVarTable {...defaultProps} searchQuery="UTF" />);
    expect(screen.getByText('LANG')).toBeInTheDocument();
    expect(screen.queryByText('PATH')).not.toBeInTheDocument();
  });

  it('shows empty state when no results', () => {
    render(<EnvVarTable {...defaultProps} searchQuery="nonexistent_xyz" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('shows empty state for persistent scope with no vars', () => {
    render(<EnvVarTable {...defaultProps} scopeFilter="user" rows={[]} searchQuery="" />);
    expect(screen.getByText('No persistent variables')).toBeInTheDocument();
  });

  it('uses persistentVars when scope is user', () => {
    const userRows = [{ key: 'MY_VAR', value: 'my_val', scope: 'user' as const }];
    render(<EnvVarTable {...defaultProps} scopeFilter="user" rows={userRows} />);
    expect(screen.getByText('MY_VAR')).toBeInTheDocument();
    expect(screen.getByText('my_val')).toBeInTheDocument();
    // Process env vars should not be shown
    expect(screen.queryByText('PATH')).not.toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked and confirmed', async () => {
    const onDelete = jest.fn();
    render(<EnvVarTable {...defaultProps} onDelete={onDelete} />);
    // There are 3 delete buttons (one per row)
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-trash-2'),
    );
    expect(deleteButtons.length).toBe(3);
    await userEvent.click(deleteButtons[0]);
    // AlertDialog confirmation appears
    const confirmBtn = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledWith('PATH', 'process');
  });

  it('shows scope badge with correct label', () => {
    render(<EnvVarTable {...defaultProps} rows={[{ key: 'A', value: 'B', scope: 'user' }]} />);
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  it('shows (empty) for empty values', () => {
    render(<EnvVarTable {...defaultProps} rows={[{ key: 'EMPTY_VAR', value: '', scope: 'process' }]} />);
    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });

  it('copies value to clipboard via copy button', async () => {
    render(<EnvVarTable {...defaultProps} rows={[{ key: 'MY_KEY', value: 'my_value', scope: 'process' }]} />);
    const copyButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-copy'),
    );
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('my_value');
  });

  it('enters inline edit mode via pencil button', async () => {
    render(<EnvVarTable {...defaultProps} rows={[{ key: 'MY_KEY', value: 'old_value', scope: 'process' }]} />);
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    // Inline edit input should appear with current value
    expect(screen.getByDisplayValue('old_value')).toBeInTheDocument();
  });

  it('saves inline edit with Enter key', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} rows={[{ key: 'MY_KEY', value: 'old_value', scope: 'process' }]} />);
    // Enter edit mode
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    const input = screen.getByDisplayValue('old_value');
    await userEvent.clear(input);
    await userEvent.type(input, 'new_value{Enter}');
    expect(onEdit).toHaveBeenCalledWith('MY_KEY', 'new_value', 'process');
  });

  it('cancels inline edit with Escape key', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} rows={[{ key: 'MY_KEY', value: 'old_value', scope: 'process' }]} />);
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    const input = screen.getByDisplayValue('old_value');
    await userEvent.type(input, '{Escape}');
    // Should exit edit mode without calling onEdit
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('old_value')).not.toBeInTheDocument();
  });

  it('saves inline edit via check button', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} rows={[{ key: 'MY_KEY', value: 'old_value', scope: 'process' }]} />);
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    // Click the check (save) button
    const checkBtn = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('.lucide-check'),
    );
    expect(checkBtn).toBeTruthy();
    await userEvent.click(checkBtn!);
    expect(onEdit).toHaveBeenCalledWith('MY_KEY', 'old_value', 'process');
  });

  it('cancels inline edit via X button', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} rows={[{ key: 'MY_KEY', value: 'old_value', scope: 'process' }]} />);
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    const xBtn = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('.lucide-x'),
    );
    expect(xBtn).toBeTruthy();
    await userEvent.click(xBtn!);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('passes row scope for inline edit in non-process scope', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} rows={[{ key: 'JAVA_HOME', value: '/opt/jdk', scope: 'user' }]} />);
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    const input = screen.getByDisplayValue('/opt/jdk');
    await userEvent.type(input, '{Enter}');
    expect(onEdit).toHaveBeenCalledWith('JAVA_HOME', '/opt/jdk', 'user');
  });

  it('renders conflict and registry type badges', () => {
    render(<EnvVarTable {...defaultProps} rows={[{ key: 'PATH', value: '/x', scope: 'system', conflict: true, regType: 'REG_EXPAND_SZ' }]} />);
    expect(screen.getByText('Conflict')).toBeInTheDocument();
    expect(screen.getByText('REG_EXPAND_SZ')).toBeInTheDocument();
  });
});

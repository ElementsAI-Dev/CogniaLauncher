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
  const defaultProps = {
    envVars: {
      PATH: '/usr/local/bin:/usr/bin',
      HOME: '/home/user',
      LANG: 'en_US.UTF-8',
    },
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
    render(<EnvVarTable {...defaultProps} scope="user" persistentVars={[]} searchQuery="" />);
    expect(screen.getByText('No persistent variables')).toBeInTheDocument();
  });

  it('uses persistentVars when scope is user', () => {
    const persistentVars: [string, string][] = [['MY_VAR', 'my_val']];
    render(<EnvVarTable {...defaultProps} scope="user" persistentVars={persistentVars} />);
    expect(screen.getByText('MY_VAR')).toBeInTheDocument();
    expect(screen.getByText('my_val')).toBeInTheDocument();
    // Process env vars should not be shown
    expect(screen.queryByText('PATH')).not.toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked', async () => {
    const onDelete = jest.fn();
    render(<EnvVarTable {...defaultProps} onDelete={onDelete} />);
    // There are 3 delete buttons (one per row)
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-trash-2'),
    );
    expect(deleteButtons.length).toBe(3);
    await userEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalled();
  });

  it('shows scope badge with correct label', () => {
    render(<EnvVarTable {...defaultProps} scope="user" persistentVars={[['A', 'B']]} />);
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  it('shows (empty) for empty values', () => {
    render(<EnvVarTable {...defaultProps} envVars={{ EMPTY_VAR: '' }} />);
    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });

  it('copies value to clipboard via copy button', async () => {
    render(<EnvVarTable {...defaultProps} envVars={{ MY_KEY: 'my_value' }} />);
    const copyButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-copy'),
    );
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('my_value');
  });

  it('enters inline edit mode via pencil button', async () => {
    render(<EnvVarTable {...defaultProps} envVars={{ MY_KEY: 'old_value' }} />);
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    // Inline edit input should appear with current value
    expect(screen.getByDisplayValue('old_value')).toBeInTheDocument();
  });

  it('saves inline edit with Enter key', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} envVars={{ MY_KEY: 'old_value' }} />);
    // Enter edit mode
    const editButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-pencil'),
    );
    await userEvent.click(editButtons[0]);
    const input = screen.getByDisplayValue('old_value');
    await userEvent.clear(input);
    await userEvent.type(input, 'new_value{Enter}');
    expect(onEdit).toHaveBeenCalledWith('MY_KEY', 'new_value');
  });

  it('cancels inline edit with Escape key', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} envVars={{ MY_KEY: 'old_value' }} />);
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
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} envVars={{ MY_KEY: 'old_value' }} />);
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
    expect(onEdit).toHaveBeenCalledWith('MY_KEY', 'old_value');
  });

  it('cancels inline edit via X button', async () => {
    const onEdit = jest.fn();
    render(<EnvVarTable {...defaultProps} onEdit={onEdit} envVars={{ MY_KEY: 'old_value' }} />);
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
});

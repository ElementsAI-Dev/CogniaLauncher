import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarPathEditor } from './envvar-path-editor';
import type { PathEntryInfo } from '@/types/tauri';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'envvar.scopes.process': 'Process',
    'envvar.scopes.user': 'User',
    'envvar.scopes.system': 'System',
    'envvar.pathEditor.title': 'Entries',
    'envvar.pathEditor.missingCount': '{count} missing',
    'envvar.pathEditor.duplicateCount': '{count} duplicates',
    'envvar.pathEditor.deduplicate': 'Deduplicate',
    'envvar.pathEditor.addPlaceholder': 'Add new path...',
    'envvar.pathEditor.add': 'Add',
    'envvar.pathEditor.empty': 'No PATH entries',
    'envvar.pathEditor.exists': 'Exists',
    'envvar.pathEditor.missing': 'Missing',
    'envvar.pathEditor.duplicate': 'Duplicate',
    'envvar.pathEditor.deduplicateSuccess': 'Removed {count} duplicates',
    'envvar.confirm.pathChangeTitle': 'Confirm Removal',
    'envvar.confirm.pathChangeDesc': 'Are you sure you want to remove this path entry?',
    'envvar.actions.delete': 'Delete',
    'envvar.pathEditor.moveUp': 'Move up',
    'envvar.pathEditor.moveDown': 'Move down',
    'envvar.pathEditor.remove': 'Remove entry',
    'common.cancel': 'Cancel',
  };
  return translations[key] || key;
};

const validEntry: PathEntryInfo = {
  path: '/usr/local/bin',
  exists: true,
  isDirectory: true,
  isDuplicate: false,
};

const missingEntry: PathEntryInfo = {
  path: '/nonexistent/path',
  exists: false,
  isDirectory: false,
  isDuplicate: false,
};

const duplicateEntry: PathEntryInfo = {
  path: '/usr/bin',
  exists: true,
  isDirectory: true,
  isDuplicate: true,
};

describe('EnvVarPathEditor', () => {
  const defaultProps = {
    pathEntries: [validEntry, missingEntry],
    pathScope: 'process' as const,
    onPathScopeChange: jest.fn(),
    onAdd: jest.fn().mockResolvedValue(true),
    onRemove: jest.fn().mockResolvedValue(true),
    onReorder: jest.fn().mockResolvedValue(true),
    onDeduplicate: jest.fn().mockResolvedValue(0),
    onRefresh: jest.fn(),
    loading: false,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders path entries with exists badge', () => {
    render(<EnvVarPathEditor {...defaultProps} />);
    expect(screen.getByText('/usr/local/bin')).toBeInTheDocument();
    expect(screen.getByText('Exists')).toBeInTheDocument();
  });

  it('renders missing badge for non-existent paths', () => {
    render(<EnvVarPathEditor {...defaultProps} />);
    expect(screen.getByText('/nonexistent/path')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  it('renders duplicate badge', () => {
    render(<EnvVarPathEditor {...defaultProps} pathEntries={[validEntry, duplicateEntry]} />);
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    render(<EnvVarPathEditor {...defaultProps} pathEntries={[]} />);
    expect(screen.getByText('No PATH entries')).toBeInTheDocument();
  });

  it('disables add button when input is empty', () => {
    render(<EnvVarPathEditor {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
  });

  it('calls onAdd and clears input on success', async () => {
    const onAdd = jest.fn().mockResolvedValue(true);
    const onRefresh = jest.fn();
    render(<EnvVarPathEditor {...defaultProps} onAdd={onAdd} onRefresh={onRefresh} />);

    await userEvent.type(screen.getByPlaceholderText('Add new path...'), '/new/path');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(onAdd).toHaveBeenCalledWith('/new/path');
    expect(onRefresh).toHaveBeenCalled();
  });

  it('triggers add on Enter key', async () => {
    const onAdd = jest.fn().mockResolvedValue(true);
    render(<EnvVarPathEditor {...defaultProps} onAdd={onAdd} />);

    const input = screen.getByPlaceholderText('Add new path...');
    await userEvent.type(input, '/new/path{Enter}');

    expect(onAdd).toHaveBeenCalledWith('/new/path');
  });

  it('disables move up at first entry and move down at last entry', () => {
    render(<EnvVarPathEditor {...defaultProps} />);
    // Get all arrow buttons - up buttons have ArrowUp icon, down buttons have ArrowDown
    const allButtons = screen.getAllByRole('button');
    const moveUpButtons = allButtons.filter((btn) => btn.querySelector('.lucide-arrow-up'));
    const moveDownButtons = allButtons.filter((btn) => btn.querySelector('.lucide-arrow-down'));

    // First entry: up disabled
    expect(moveUpButtons[0]).toBeDisabled();
    // Last entry: down disabled
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });

  it('shows deduplicate button when duplicates exist', () => {
    render(<EnvVarPathEditor {...defaultProps} pathEntries={[validEntry, duplicateEntry]} />);
    expect(screen.getByRole('button', { name: /deduplicate/i })).toBeInTheDocument();
  });

  it('hides deduplicate button when no duplicates', () => {
    render(<EnvVarPathEditor {...defaultProps} pathEntries={[validEntry]} />);
    expect(screen.queryByRole('button', { name: /deduplicate/i })).not.toBeInTheDocument();
  });

  it('shows entry count summary', () => {
    render(<EnvVarPathEditor {...defaultProps} />);
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('calls onRemove when delete is confirmed', async () => {
    const onRemove = jest.fn().mockResolvedValue(true);
    const onRefresh = jest.fn();
    render(<EnvVarPathEditor {...defaultProps} onRemove={onRemove} onRefresh={onRefresh} />);
    // Click the delete (trash) button on first entry
    const trashButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-trash-2'),
    );
    await userEvent.click(trashButtons[0]);
    // Confirm in alert dialog
    const confirmBtn = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(confirmBtn);
    expect(onRemove).toHaveBeenCalledWith('/usr/local/bin');
  });

  it('calls onDeduplicate and shows toast', async () => {
    const { toast } = jest.requireMock('sonner');
    const onDeduplicate = jest.fn().mockResolvedValue(2);
    const onRefresh = jest.fn();
    render(
      <EnvVarPathEditor
        {...defaultProps}
        pathEntries={[validEntry, duplicateEntry]}
        onDeduplicate={onDeduplicate}
        onRefresh={onRefresh}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /deduplicate/i }));
    expect(onDeduplicate).toHaveBeenCalled();
    await screen.findByRole('button', { name: /deduplicate/i });
    expect(toast.success).toHaveBeenCalled();
  });

  it('calls onReorder when moving entry up', async () => {
    const onReorder = jest.fn().mockResolvedValue(true);
    const onRefresh = jest.fn();
    render(<EnvVarPathEditor {...defaultProps} onReorder={onReorder} onRefresh={onRefresh} />);
    // Click move-up on second entry
    const upButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-arrow-up'),
    );
    // Second entry's up button (index 1)
    await userEvent.click(upButtons[1]);
    expect(onReorder).toHaveBeenCalledWith(['/nonexistent/path', '/usr/local/bin']);
  });

  it('calls onReorder when moving entry down', async () => {
    const onReorder = jest.fn().mockResolvedValue(true);
    const onRefresh = jest.fn();
    render(<EnvVarPathEditor {...defaultProps} onReorder={onReorder} onRefresh={onRefresh} />);
    // Click move-down on first entry
    const downButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-arrow-down'),
    );
    await userEvent.click(downButtons[0]);
    expect(onReorder).toHaveBeenCalledWith(['/nonexistent/path', '/usr/local/bin']);
  });
});

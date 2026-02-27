import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarEditDialog } from './envvar-edit-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'envvar.actions.edit': 'Edit Variable',
    'envvar.actions.add': 'Add Variable',
    'envvar.description': 'Manage environment variables',
    'envvar.table.key': 'Key',
    'envvar.table.value': 'Value',
    'envvar.table.scope': 'Scope',
    'envvar.scopes.process': 'Process',
    'envvar.scopes.user': 'User',
    'envvar.scopes.system': 'System',
    'envvar.errors.keyEmpty': 'Key cannot be empty',
    'envvar.errors.keyInvalid': 'Key contains invalid characters',
    'envvar.confirm.systemWarnTitle': 'System Warning',
    'envvar.confirm.systemWarnDesc': 'Modifying system variables can affect all users.',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
  };
  return translations[key] || key;
};

describe('EnvVarEditDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSave: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders add mode title when no editKey', () => {
    render(<EnvVarEditDialog {...defaultProps} />);
    // Title and save button both show "Add Variable"
    const elements = screen.getAllByText('Add Variable');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders edit mode title when editKey provided', () => {
    render(<EnvVarEditDialog {...defaultProps} editKey="PATH" editValue="/usr/bin" />);
    expect(screen.getByText('Edit Variable')).toBeInTheDocument();
  });

  it('disables key input in edit mode', () => {
    render(<EnvVarEditDialog {...defaultProps} editKey="PATH" editValue="/usr/bin" />);
    expect(screen.getByLabelText('Key')).toBeDisabled();
  });

  it('shows scope selector only in add mode', () => {
    const { rerender } = render(<EnvVarEditDialog {...defaultProps} />);
    expect(screen.getByText('Scope')).toBeInTheDocument();

    rerender(<EnvVarEditDialog {...defaultProps} editKey="FOO" editValue="bar" />);
    expect(screen.queryByText('Scope')).not.toBeInTheDocument();
  });

  it('validates empty key and shows error via Enter in value field', async () => {
    render(<EnvVarEditDialog {...defaultProps} />);
    // Type a space in key (button disabled since trim is empty)
    await userEvent.type(screen.getByLabelText('Key'), ' ');
    // Press Enter in value field to bypass disabled button
    await userEvent.type(screen.getByLabelText('Value'), '{Enter}');
    expect(screen.getByText('Key cannot be empty')).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('validates invalid key characters', async () => {
    render(<EnvVarEditDialog {...defaultProps} />);
    await userEvent.type(screen.getByLabelText('Key'), 'BAD KEY');
    const saveButtons = screen.getAllByRole('button', { name: /add variable/i });
    await userEvent.click(saveButtons[saveButtons.length - 1]);
    expect(screen.getByText('Key contains invalid characters')).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with correct args on valid save', async () => {
    const onSave = jest.fn();
    render(<EnvVarEditDialog {...defaultProps} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Key'), 'MY_VAR');
    await userEvent.type(screen.getByLabelText('Value'), 'my_value');
    const saveButtons = screen.getAllByRole('button', { name: /add variable/i });
    await userEvent.click(saveButtons[saveButtons.length - 1]);
    expect(onSave).toHaveBeenCalledWith('MY_VAR', 'my_value', 'process');
  });

  it('save button disabled when key is empty', () => {
    render(<EnvVarEditDialog {...defaultProps} />);
    const allBtns = screen.getAllByRole('button');
    const footerSave = allBtns.find(
      (btn) => btn.textContent?.includes('Add Variable') && !btn.closest('[role="tablist"]'),
    );
    expect(footerSave).toBeDisabled();
  });

  it('cancel button calls onOpenChange(false)', async () => {
    const onOpenChange = jest.fn();
    render(<EnvVarEditDialog {...defaultProps} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Enter key in value field triggers save', async () => {
    const onSave = jest.fn();
    render(<EnvVarEditDialog {...defaultProps} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Key'), 'VALID_KEY');
    await userEvent.type(screen.getByLabelText('Value'), 'some_val{Enter}');
    expect(onSave).toHaveBeenCalledWith('VALID_KEY', 'some_val', 'process');
  });

  it('renders description text', () => {
    render(<EnvVarEditDialog {...defaultProps} />);
    expect(screen.getByText('Manage environment variables')).toBeInTheDocument();
  });

  it('clears error when key input changes', async () => {
    render(<EnvVarEditDialog {...defaultProps} />);
    // Trigger error via Enter in value field (key is space-only)
    await userEvent.type(screen.getByLabelText('Key'), ' ');
    await userEvent.type(screen.getByLabelText('Value'), '{Enter}');
    expect(screen.getByText('Key cannot be empty')).toBeInTheDocument();

    // Type a valid character → error should clear
    await userEvent.type(screen.getByLabelText('Key'), 'A');
    expect(screen.queryByText('Key cannot be empty')).not.toBeInTheDocument();
  });
});

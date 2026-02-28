import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitConfigCard } from './git-config-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitConfigCard', () => {
  const mockOnSet = jest.fn().mockResolvedValue(undefined);
  const mockOnRemove = jest.fn().mockResolvedValue(undefined);

  const config = [
    { key: 'user.name', value: 'John Doe' },
    { key: 'user.email', value: 'john@example.com' },
    { key: 'core.autocrlf', value: 'true' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders config entries', () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    expect(screen.getByText('user.name')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('user.email')).toBeInTheDocument();
  });

  it('shows empty state when no config', () => {
    render(<GitConfigCard config={[]} onSet={mockOnSet} onRemove={mockOnRemove} />);
    expect(screen.getByText('git.config.empty')).toBeInTheDocument();
  });

  it('shows add button', () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    expect(screen.getByText('git.config.add')).toBeInTheDocument();
  });

  it('disables add button when key is empty', () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    const addButton = screen.getByText('git.config.add');
    expect(addButton.closest('button')).toBeDisabled();
  });

  it('renders delete buttons for each entry', () => {
    const { container } = render(
      <GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />,
    );
    const deleteButtons = container.querySelectorAll('button');
    // 3 delete buttons + 1 add button = at least 4 buttons
    expect(deleteButtons.length).toBeGreaterThanOrEqual(4);
  });

  it('calls onSet when adding a new entry', async () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    const inputs = screen.getAllByRole('textbox');
    const keyInput = inputs.find(i => (i as HTMLInputElement).placeholder === 'git.config.keyPlaceholder')!;
    const valueInput = inputs.find(i => (i as HTMLInputElement).placeholder === 'git.config.valuePlaceholder')!;
    fireEvent.change(keyInput, { target: { value: 'core.editor' } });
    fireEvent.change(valueInput, { target: { value: 'vim' } });
    fireEvent.click(screen.getByText('git.config.add'));
    await waitFor(() => {
      expect(mockOnSet).toHaveBeenCalledWith('core.editor', 'vim');
    });
  });

  it('clears inputs after adding entry', async () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    const inputs = screen.getAllByRole('textbox');
    const keyInput = inputs.find(i => (i as HTMLInputElement).placeholder === 'git.config.keyPlaceholder')!;
    const valueInput = inputs.find(i => (i as HTMLInputElement).placeholder === 'git.config.valuePlaceholder')!;
    fireEvent.change(keyInput, { target: { value: 'core.editor' } });
    fireEvent.change(valueInput, { target: { value: 'vim' } });
    fireEvent.click(screen.getByText('git.config.add'));
    await waitFor(() => {
      expect(keyInput).toHaveValue('');
      expect(valueInput).toHaveValue('');
    });
  });

  it('does not call onSet when key is empty', () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    fireEvent.click(screen.getByText('git.config.add'));
    expect(mockOnSet).not.toHaveBeenCalled();
  });

  it('calls onRemove when delete button clicked and confirmed', async () => {
    render(
      <GitConfigCard config={[{ key: 'user.name', value: 'John' }]} onSet={mockOnSet} onRemove={mockOnRemove} />,
    );
    // Click the trash/delete button which opens AlertDialog
    const deleteButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(deleteButton);
    // Confirm in the AlertDialog
    await waitFor(() => {
      expect(screen.getByText('git.config.confirmRemove')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('git.config.confirmRemove'));
    expect(mockOnRemove).toHaveBeenCalledWith('user.name');
  });

  it('enters edit mode when value is clicked', () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    fireEvent.click(screen.getByText('John Doe'));
    // In edit mode, an input with the current value should appear
    const editInput = screen.getAllByRole('textbox').find(
      i => (i as HTMLInputElement).value === 'John Doe'
    );
    expect(editInput).toBeInTheDocument();
  });

  it('saves edit on Enter key in edit mode', async () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    fireEvent.click(screen.getByText('John Doe'));
    const editInput = screen.getAllByRole('textbox').find(
      i => (i as HTMLInputElement).value === 'John Doe'
    )!;
    fireEvent.change(editInput, { target: { value: 'Jane Doe' } });
    fireEvent.keyDown(editInput, { key: 'Enter' });
    await waitFor(() => {
      expect(mockOnSet).toHaveBeenCalledWith('user.name', 'Jane Doe');
    });
  });

  it('adds entry on Enter key in value input', async () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    const inputs = screen.getAllByRole('textbox');
    const keyInput = inputs.find(i => (i as HTMLInputElement).placeholder === 'git.config.keyPlaceholder')!;
    const valueInput = inputs.find(i => (i as HTMLInputElement).placeholder === 'git.config.valuePlaceholder')!;
    fireEvent.change(keyInput, { target: { value: 'core.pager' } });
    fireEvent.change(valueInput, { target: { value: 'less' } });
    fireEvent.keyDown(valueInput, { key: 'Enter' });
    await waitFor(() => {
      expect(mockOnSet).toHaveBeenCalledWith('core.pager', 'less');
    });
  });

  it('renders config title', () => {
    render(<GitConfigCard config={config} onSet={mockOnSet} onRemove={mockOnRemove} />);
    expect(screen.getByText('git.config.title')).toBeInTheDocument();
  });
});

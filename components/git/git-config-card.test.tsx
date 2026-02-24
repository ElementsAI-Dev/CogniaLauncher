import { render, screen } from '@testing-library/react';
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
    // Each entry should have a delete button (Trash2 icon)
    const deleteButtons = container.querySelectorAll('button');
    // 3 delete buttons + 1 add button = at least 4 buttons
    expect(deleteButtons.length).toBeGreaterThanOrEqual(4);
  });
});

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GitAliasCard } from './git-alias-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitAliasCard', () => {
  const mockListAliases = jest.fn();
  const mockSetAlias = jest.fn().mockResolvedValue(undefined);
  const mockRemoveAlias = jest.fn().mockResolvedValue(undefined);

  const aliases = [
    { key: 'co', value: 'checkout' },
    { key: 'br', value: 'branch' },
    { key: 'st', value: 'status' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockListAliases.mockResolvedValue(aliases);
  });

  it('renders alias title', async () => {
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('git.alias.title')).toBeInTheDocument();
    });
  });

  it('renders alias entries after loading', async () => {
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('git co')).toBeInTheDocument();
      expect(screen.getByText('checkout')).toBeInTheDocument();
      expect(screen.getByText('git br')).toBeInTheDocument();
    });
  });

  it('shows empty state when no aliases', async () => {
    mockListAliases.mockResolvedValue([]);
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('git.alias.empty')).toBeInTheDocument();
    });
  });

  it('shows count badge', async () => {
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows apply presets button', async () => {
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('git.alias.applyPresets')).toBeInTheDocument();
    });
  });

  it('shows recommended aliases that are not yet configured', async () => {
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });
    await waitFor(() => {
      // "ci", "lg", "last", "unstage", "amend" are recommended but not in current aliases
      expect(screen.getByText('git.alias.recommended')).toBeInTheDocument();
    });
  });

  it('calls onSetAlias when adding a new alias', async () => {
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('git.alias.add')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs.find(
      (i) => (i as HTMLInputElement).placeholder === 'git.alias.namePlaceholder',
    )!;
    const cmdInput = inputs.find(
      (i) => (i as HTMLInputElement).placeholder === 'git.alias.commandPlaceholder',
    )!;

    fireEvent.change(nameInput, { target: { value: 'ci' } });
    fireEvent.change(cmdInput, { target: { value: 'commit' } });
    fireEvent.click(screen.getByText('git.alias.add'));

    await waitFor(() => {
      expect(mockSetAlias).toHaveBeenCalledWith('ci', 'commit');
    });
  });

  it('disables add button when name is empty', async () => {
    await act(async () => {
      render(
        <GitAliasCard
          onListAliases={mockListAliases}
          onSetAlias={mockSetAlias}
          onRemoveAlias={mockRemoveAlias}
        />,
      );
    });
    await waitFor(() => {
      const addBtn = screen.getByText('git.alias.add').closest('button');
      expect(addBtn).toBeDisabled();
    });
  });
});

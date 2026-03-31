import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitLocalConfigCard } from './git-local-config-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key.replace('{count}', params?.count ?? ''),
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const { toast: mockToast } = jest.requireMock('sonner') as {
  toast: { success: jest.Mock; error: jest.Mock };
};

describe('GitLocalConfigCard', () => {
  const createProps = () => ({
    config: [
      { key: 'core.editor', value: 'vim' },
      { key: 'user.name', value: 'Alice' },
    ],
    onRefresh: jest.fn().mockResolvedValue(undefined),
    onSet: jest.fn().mockResolvedValue(undefined),
    onRemove: jest.fn().mockResolvedValue(undefined),
    onGetValue: jest.fn().mockResolvedValue(null),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders existing entries and refreshes after adding a trimmed key', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitLocalConfigCard {...props} />);

    expect(screen.getByText('core.editor')).toBeInTheDocument();
    expect(screen.getByText('vim')).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('git.config.keyPlaceholder'),
      '  user.email  ',
    );
    await user.type(
      screen.getByPlaceholderText('git.config.valuePlaceholder'),
      'alice@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'git.config.add' }));

    await waitFor(() => {
      expect(props.onSet).toHaveBeenCalledWith(
        'user.email',
        'alice@example.com',
      );
    });
    expect(props.onRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('git.config.keyPlaceholder'),
      ).toHaveValue('');
      expect(
        screen.getByPlaceholderText('git.config.valuePlaceholder'),
      ).toHaveValue('');
    });
  });

  it('removes existing keys and shows the empty state when no config exists', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitLocalConfigCard {...props} />);

    await user.click(screen.getAllByTitle('git.config.remove')[0]);
    await waitFor(() => {
      expect(props.onRemove).toHaveBeenCalledWith('core.editor');
    });
    expect(props.onRefresh).toHaveBeenCalled();

    rerender(<GitLocalConfigCard {...props} config={[]} />);
    expect(screen.getByText('git.config.empty')).toBeInTheDocument();
  });

  it('disables add while loading and surfaces action failures', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitLocalConfigCard {...props} loading={true} />);
    expect(screen.getByRole('button', { name: 'git.config.add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'git.refresh' })).toBeDisabled();
    expect(screen.getAllByTitle('git.config.remove')[0]).toBeDisabled();

    rerender(
      <GitLocalConfigCard
        {...props}
        config={[]}
        onSet={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.config.keyPlaceholder'), {
      target: { value: 'user.email' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('git.config.valuePlaceholder'),
      { target: { value: 'alice@example.com' } },
    );
    await user.click(screen.getByRole('button', { name: 'git.config.add' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

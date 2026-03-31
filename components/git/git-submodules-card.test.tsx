import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitSubmodulesCard } from './git-submodules-card';

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

describe('GitSubmodulesCard', () => {
  const createProps = () => ({
    submodules: [
      {
        path: 'vendor/sdk',
        url: 'https://example.com/sdk.git',
        branch: 'main',
        hash: 'abcdef1234567890',
        describe: 'sdk@v1.0.0',
        status: 'clean',
      },
    ],
    onRefresh: jest.fn().mockResolvedValue(undefined),
    onAdd: jest.fn().mockResolvedValue('added'),
    onUpdate: jest.fn().mockResolvedValue('updated'),
    onRemove: jest.fn().mockResolvedValue('removed'),
    onSync: jest.fn().mockResolvedValue('synced'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the empty state and adds a submodule with trimmed values', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitSubmodulesCard {...props} submodules={[]} />);

    expect(screen.getByText('git.submodules.noSubmodules')).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('git.submodules.urlPlaceholder'),
      '  https://example.com/new.git  ',
    );
    await user.type(
      screen.getByPlaceholderText('git.submodules.pathPlaceholder'),
      '  vendor/new  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.submodules.add' }));

    await waitFor(() => {
      expect(props.onAdd).toHaveBeenCalledWith(
        'https://example.com/new.git',
        'vendor/new',
      );
    });
    expect(props.onRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('git.submodules.urlPlaceholder'),
      ).toHaveValue('');
      expect(
        screen.getByPlaceholderText('git.submodules.pathPlaceholder'),
      ).toHaveValue('');
    });
  });

  it('wires update, sync, refresh, and remove actions', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitSubmodulesCard {...props} />);

    await user.click(screen.getByRole('button', { name: 'git.submodules.update' }));
    await waitFor(() => {
      expect(props.onUpdate).toHaveBeenCalledWith(true, true);
    });

    await user.click(screen.getByRole('button', { name: 'git.submodules.sync' }));
    await waitFor(() => {
      expect(props.onSync).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'git.refresh' }));
    expect(props.onRefresh).toHaveBeenCalled();

    await user.click(screen.getByTitle('git.submodules.remove'));
    await waitFor(() => {
      expect(props.onRemove).toHaveBeenCalledWith('vendor/sdk');
    });
  });

  it('disables actions while loading and shows toast errors on failed actions', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const failingAdd = jest.fn().mockRejectedValue(new Error('boom'));

    const { rerender } = render(<GitSubmodulesCard {...props} loading={true} />);

    expect(
      screen.getByRole('button', { name: 'git.submodules.update' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'git.submodules.sync' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'git.refresh' })).toBeDisabled();
    expect(screen.getByTitle('git.submodules.remove')).toBeDisabled();

    rerender(
      <GitSubmodulesCard {...props} submodules={[]} onAdd={failingAdd} />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.submodules.urlPlaceholder'), {
      target: { value: 'https://example.com/new.git' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('git.submodules.pathPlaceholder'),
      { target: { value: 'vendor/new' } },
    );
    await user.click(screen.getByRole('button', { name: 'git.submodules.add' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

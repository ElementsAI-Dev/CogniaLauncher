import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitRemotePruneCard } from './git-remote-prune-card';

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

describe('GitRemotePruneCard', () => {
  const remotes = [
    { name: 'origin', fetchUrl: 'a', pushUrl: 'a' },
    { name: 'upstream', fetchUrl: 'b', pushUrl: 'b' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to the first remote and resyncs when remotes change', async () => {
    const onPrune = jest.fn().mockResolvedValue('pruned');
    const { rerender } = render(
      <GitRemotePruneCard remotes={remotes} onPrune={onPrune} />,
    );

    expect(screen.getByPlaceholderText('origin')).toHaveValue('origin');

    rerender(
      <GitRemotePruneCard
        remotes={[{ name: 'mirror', fetchUrl: 'c', pushUrl: 'c' }]}
        onPrune={onPrune}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('origin')).toHaveValue('mirror');
    });
  });

  it('passes trimmed input to prune and restores the first remote when cleared', async () => {
    const user = userEvent.setup();
    const onPrune = jest.fn().mockResolvedValue('pruned');

    render(<GitRemotePruneCard remotes={remotes} onPrune={onPrune} />);

    await user.clear(screen.getByPlaceholderText('origin'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('origin')).toHaveValue('origin');
    });

    fireEvent.change(screen.getByPlaceholderText('origin'), {
      target: { value: '  upstream  ' },
    });
    await user.click(screen.getByRole('button', { name: 'git.remotePrune.title' }));

    await waitFor(() => {
      expect(onPrune).toHaveBeenCalledWith('upstream');
    });
  });

  it('surfaces prune failures with a toast', async () => {
    const user = userEvent.setup();

    render(
      <GitRemotePruneCard
        remotes={remotes}
        onPrune={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'git.remotePrune.title' }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

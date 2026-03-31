import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitLfsCard } from './git-lfs-card';

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

describe('GitLfsCard', () => {
  const createProps = () => ({
    lfsAvailable: true,
    lfsVersion: '3.4.0',
    trackedPatterns: ['*.psd'],
    lfsFiles: [
      {
        oid: '1234567890abcdef',
        name: 'design.psd',
        size: 123,
        pointerStatus: 'pointer',
      },
    ],
    onCheckAvailability: jest.fn().mockResolvedValue(undefined),
    onRefreshTrackedPatterns: jest.fn().mockResolvedValue(undefined),
    onRefreshLfsFiles: jest.fn().mockResolvedValue(undefined),
    onTrack: jest.fn().mockResolvedValue('tracked'),
    onUntrack: jest.fn().mockResolvedValue('untracked'),
    onInstall: jest.fn().mockResolvedValue('installed'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes LFS state on mount and manual refresh', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitLfsCard {...props} />);

    await waitFor(() => {
      expect(props.onCheckAvailability).toHaveBeenCalledTimes(1);
      expect(props.onRefreshTrackedPatterns).toHaveBeenCalledTimes(1);
      expect(props.onRefreshLfsFiles).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'git.refresh' }));
    await waitFor(() => {
      expect(props.onCheckAvailability).toHaveBeenCalledTimes(2);
    });
  });

  it('installs when unavailable and wires track and untrack actions', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(
      <GitLfsCard {...props} lfsAvailable={false} lfsVersion={null} trackedPatterns={[]} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'git.lfs.install' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'git.lfs.install' }));
    await waitFor(() => {
      expect(props.onInstall).toHaveBeenCalled();
    });

    rerender(<GitLfsCard {...props} />);

    await user.click(screen.getByTitle('git.lfs.untrack'));
    await waitFor(() => {
      expect(props.onUntrack).toHaveBeenCalledWith('*.psd');
    });

    await user.type(
      screen.getByPlaceholderText('git.lfs.trackPlaceholder'),
      '  *.zip  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.lfs.track' }));
    await waitFor(() => {
      expect(props.onTrack).toHaveBeenCalledWith('*.zip');
    });
  });

  it('renders file data, disables controls while loading, and shows errors', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitLfsCard {...props} loading={true} />);

    expect(screen.getByRole('button', { name: 'git.refresh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'git.lfs.track' })).toBeDisabled();
    expect(screen.getByTitle('git.lfs.untrack')).toBeDisabled();
    expect(screen.getByText('design.psd')).toBeInTheDocument();

    rerender(
      <GitLfsCard
        {...props}
        onTrack={jest.fn().mockRejectedValue(new Error('boom'))}
        trackedPatterns={[]}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.lfs.trackPlaceholder'), {
      target: { value: '*.tar' },
    });
    await user.click(screen.getByRole('button', { name: 'git.lfs.track' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });

  it('shows empty states and reports refresh failures from mount-time probes', async () => {
    render(
      <GitLfsCard
        {...createProps()}
        lfsAvailable={false}
        lfsVersion={null}
        trackedPatterns={[]}
        lfsFiles={[]}
        onCheckAvailability={jest.fn().mockRejectedValue(new Error('probe failed'))}
      />,
    );

    expect(screen.getByText('git.lfs.noPatterns')).toBeInTheDocument();
    expect(screen.getByText('git.lfs.noFiles')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: probe failed');
    });
  });
});

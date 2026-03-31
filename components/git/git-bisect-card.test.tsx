import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitBisectCard } from './git-bisect-card';

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

describe('GitBisectCard', () => {
  const createProps = () => ({
    bisectState: {
      active: false,
      currentHash: null,
      stepsTaken: 0,
      remainingEstimate: null,
    },
    onRefreshState: jest.fn().mockResolvedValue(undefined),
    onStart: jest.fn().mockResolvedValue('started'),
    onGood: jest.fn().mockResolvedValue('good'),
    onBad: jest.fn().mockResolvedValue('bad'),
    onSkip: jest.fn().mockResolvedValue('skip'),
    onReset: jest.fn().mockResolvedValue('reset'),
    onLog: jest.fn().mockResolvedValue('log output'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows support gating and disables the start action when blocked', () => {
    render(
      <GitBisectCard
        {...createProps()}
        supportReason="bisect unsupported"
      />,
    );

    expect(screen.getByText('bisect unsupported')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'git.bisect.start' })).toBeDisabled();
  });

  it('starts bisect from the inactive state with trimmed refs', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitBisectCard {...props} />);

    await user.type(
      screen.getByPlaceholderText('git.bisect.goodRefPlaceholder'),
      '  v1.0.0  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.bisect.start' }));

    await waitFor(() => {
      expect(props.onStart).toHaveBeenCalledWith('HEAD', 'v1.0.0');
    });
    expect(props.onRefreshState).toHaveBeenCalled();
  });

  it('renders active controls and shows bisect log output', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(
      <GitBisectCard
        {...props}
        bisectState={{
          active: true,
          currentHash: 'abcdef123456',
          stepsTaken: 3,
          remainingEstimate: 2,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'git.bisect.good' }));
    await user.click(screen.getByRole('button', { name: 'git.bisect.bad' }));
    await user.click(screen.getByRole('button', { name: 'git.bisect.skip' }));
    await user.click(screen.getByRole('button', { name: 'git.bisect.log' }));
    await user.click(screen.getByRole('button', { name: 'git.bisect.reset' }));

    await waitFor(() => {
      expect(props.onGood).toHaveBeenCalled();
      expect(props.onBad).toHaveBeenCalled();
      expect(props.onSkip).toHaveBeenCalled();
      expect(props.onLog).toHaveBeenCalled();
      expect(props.onReset).toHaveBeenCalled();
    });
    expect(screen.getByText('log output')).toBeInTheDocument();
  });

  it('surfaces log failures through toast', async () => {
    const user = userEvent.setup();

    render(
      <GitBisectCard
        {...createProps()}
        bisectState={{
          active: true,
          currentHash: 'abcdef123456',
          stepsTaken: 3,
          remainingEstimate: 2,
        }}
        onLog={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'git.bisect.log' }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

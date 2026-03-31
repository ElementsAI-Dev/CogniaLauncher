import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitInteractiveRebaseCard } from './git-interactive-rebase-card';

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

describe('GitInteractiveRebaseCard', () => {
  const createProps = () => ({
    onPreview: jest.fn().mockResolvedValue([
      { action: 'pick', hash: 'abc12345', message: 'feat: first' },
      { action: 'pick', hash: 'def67890', message: 'fix: second' },
    ]),
    onStart: jest.fn().mockResolvedValue('started'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows support gating and disables preview and execute buttons when blocked', () => {
    render(
      <GitInteractiveRebaseCard
        {...createProps()}
        supportReason="interactive rebase unavailable"
      />,
    );

    expect(
      screen.getByText('interactive rebase unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'git.interactiveRebase.preview' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'git.interactiveRebase.execute' }),
    ).toBeDisabled();
  });

  it('loads a preview, lets the user edit actions, and starts the rebase', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitInteractiveRebaseCard {...props} />);

    await user.type(
      screen.getByPlaceholderText('git.interactiveRebase.basePlaceholder'),
      '  HEAD~3  ',
    );
    await user.click(
      screen.getByRole('button', { name: 'git.interactiveRebase.preview' }),
    );

    await waitFor(() => {
      expect(props.onPreview).toHaveBeenCalledWith('HEAD~3');
    });
    expect(screen.getByText('feat: first')).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'squash' },
    });
    await user.click(
      screen.getByRole('button', { name: 'git.interactiveRebase.execute' }),
    );

    await waitFor(() => {
      expect(props.onStart).toHaveBeenCalledWith('HEAD~3', [
        { action: 'squash', hash: 'abc12345', message: 'feat: first' },
        { action: 'pick', hash: 'def67890', message: 'fix: second' },
      ]);
    });
  });

  it('surfaces preview failures through toast', async () => {
    const user = userEvent.setup();

    render(
      <GitInteractiveRebaseCard
        onPreview={jest.fn().mockRejectedValue(new Error('boom'))}
        onStart={jest.fn().mockResolvedValue('started')}
      />,
    );

    await user.type(
      screen.getByPlaceholderText('git.interactiveRebase.basePlaceholder'),
      'HEAD~2',
    );
    await user.click(
      screen.getByRole('button', { name: 'git.interactiveRebase.preview' }),
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

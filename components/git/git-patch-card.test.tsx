import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitPatchCard } from './git-patch-card';

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

describe('GitPatchCard', () => {
  const createProps = () => ({
    onFormatPatch: jest.fn().mockResolvedValue(['/tmp/0001.patch']),
    onApplyPatch: jest.fn().mockResolvedValue('applied'),
    onApplyMailbox: jest.fn().mockResolvedValue('mailbox applied'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows support gating and disables create when blocked', () => {
    render(
      <GitPatchCard
        {...createProps()}
        supportReason="patch operations unavailable"
      />,
    );

    expect(screen.getByText('patch operations unavailable')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'git.patch.create' }),
    ).toBeDisabled();
  });

  it('creates patches with trimmed inputs and renders the created file list', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitPatchCard {...props} />);

    await user.clear(screen.getByPlaceholderText('git.patch.rangePlaceholder'));
    await user.type(
      screen.getByPlaceholderText('git.patch.rangePlaceholder'),
      '  HEAD~1..HEAD  ',
    );
    await user.type(
      screen.getByPlaceholderText('git.patch.outputDir'),
      '  /tmp/out  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.patch.create' }));

    await waitFor(() => {
      expect(props.onFormatPatch).toHaveBeenCalledWith('HEAD~1..HEAD', '/tmp/out');
    });
    expect(screen.getByText('/tmp/0001.patch')).toBeInTheDocument();
  });

  it('applies patches in check-only mode and supports mailbox apply', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitPatchCard {...props} />);

    await user.click(screen.getByRole('tab', { name: 'git.patch.applyTab' }));
    await user.type(
      screen.getByPlaceholderText('git.patch.patchFile'),
      '  /tmp/0001.patch  ',
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'git.patch.apply' }));

    await waitFor(() => {
      expect(props.onApplyPatch).toHaveBeenCalledWith('/tmp/0001.patch', true);
    });

    await user.click(screen.getByRole('button', { name: 'git.patch.applyMailbox' }));
    await waitFor(() => {
      expect(props.onApplyMailbox).toHaveBeenCalledWith('/tmp/0001.patch');
    });
  });

  it('surfaces apply failures through toast', async () => {
    const user = userEvent.setup();

    render(
      <GitPatchCard
        {...createProps()}
        onApplyPatch={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'git.patch.applyTab' }));
    fireEvent.change(screen.getByPlaceholderText('git.patch.patchFile'), {
      target: { value: '/tmp/0002.patch' },
    });
    await user.click(screen.getByRole('button', { name: 'git.patch.apply' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });

  it('applies patches without check-only by default', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitPatchCard {...props} />);

    await user.click(screen.getByRole('tab', { name: 'git.patch.applyTab' }));
    await user.type(
      screen.getByPlaceholderText('git.patch.patchFile'),
      '/tmp/0003.patch',
    );
    await user.click(screen.getByRole('button', { name: 'git.patch.apply' }));

    await waitFor(() => {
      expect(props.onApplyPatch).toHaveBeenCalledWith('/tmp/0003.patch', false);
    });
  });
});

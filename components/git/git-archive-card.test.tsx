import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitArchiveCard } from './git-archive-card';

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

describe('GitArchiveCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows support gating and required-field disabling', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <GitArchiveCard
        supportReason="archive unavailable"
        onArchive={jest.fn().mockResolvedValue('ok')}
      />,
    );

    expect(screen.getByText('archive unavailable')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'git.archive.create' }),
    ).toBeDisabled();

    rerender(
      <GitArchiveCard onArchive={jest.fn().mockResolvedValue('ok')} />,
    );
    await user.clear(screen.getByPlaceholderText('git.archive.outputPath'));
    expect(
      screen.getByRole('button', { name: 'git.archive.create' }),
    ).toBeDisabled();

    rerender(<GitArchiveCard loading={true} onArchive={jest.fn().mockResolvedValue('ok')} />);
    expect(
      screen.getByRole('button', { name: 'git.archive.create' }),
    ).toBeDisabled();
  });

  it('trims archive inputs before invoking the action', async () => {
    const user = userEvent.setup();
    const onArchive = jest.fn().mockResolvedValue('created');

    render(<GitArchiveCard onArchive={onArchive} />);

    await user.clear(screen.getByPlaceholderText('git.archive.format'));
    await user.type(screen.getByPlaceholderText('git.archive.format'), '  tar  ');
    await user.clear(screen.getByPlaceholderText('git.archive.refPlaceholder'));
    await user.type(
      screen.getByPlaceholderText('git.archive.refPlaceholder'),
      '  v1.0.0  ',
    );
    await user.type(
      screen.getByPlaceholderText('git.archive.outputPath'),
      '  /tmp/repo.tar  ',
    );
    await user.type(
      screen.getByPlaceholderText('git.archive.prefixPlaceholder'),
      '  repo/  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.archive.create' }));

    await waitFor(() => {
      expect(onArchive).toHaveBeenCalledWith(
        'tar',
        '/tmp/repo.tar',
        'v1.0.0',
        'repo/',
      );
    });
  });

  it('surfaces archive failures through toast', async () => {
    const user = userEvent.setup();

    render(
      <GitArchiveCard
        onArchive={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.archive.outputPath'), {
      target: { value: '/tmp/repo.zip' },
    });
    await user.click(screen.getByRole('button', { name: 'git.archive.create' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

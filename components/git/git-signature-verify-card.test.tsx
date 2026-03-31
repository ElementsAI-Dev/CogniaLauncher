import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitSignatureVerifyCard } from './git-signature-verify-card';

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

describe('GitSignatureVerifyCard', () => {
  const createProps = () => ({
    onVerifyCommit: jest.fn().mockResolvedValue('good signature'),
    onVerifyTag: jest.fn().mockResolvedValue('good tag'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows support gating and disables both verification paths when blocked', () => {
    render(
      <GitSignatureVerifyCard
        {...createProps()}
        supportReason="signature verification unavailable"
      />,
    );

    expect(
      screen.getByText('signature verification unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'git.signature.verifyCommit' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'git.signature.verifyTag' }),
    ).toBeDisabled();
  });

  it('verifies commit hashes with trimmed input and renders the result badge', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitSignatureVerifyCard {...props} />);

    await user.type(screen.getByPlaceholderText('commit hash'), '  abc123  ');
    await user.click(
      screen.getByRole('button', { name: 'git.signature.verifyCommit' }),
    );

    await waitFor(() => {
      expect(props.onVerifyCommit).toHaveBeenCalledWith('abc123');
    });
    expect(screen.getByText('good signature')).toBeInTheDocument();
  });

  it('verifies tags and surfaces failures with toast fallbacks', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitSignatureVerifyCard {...props} />);

    await user.type(screen.getByPlaceholderText('tag'), '  v1.0.0  ');
    await user.click(
      screen.getByRole('button', { name: 'git.signature.verifyTag' }),
    );
    await waitFor(() => {
      expect(props.onVerifyTag).toHaveBeenCalledWith('v1.0.0');
    });

    rerender(
      <GitSignatureVerifyCard
        {...props}
        onVerifyCommit={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('commit hash'), {
      target: { value: 'def456' },
    });
    await user.click(
      screen.getByRole('button', { name: 'git.signature.verifyCommit' }),
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHooksCard } from './git-hooks-card';

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

describe('GitHooksCard', () => {
  const createProps = () => ({
    hooks: [
      {
        name: 'pre-commit',
        enabled: true,
        hasContent: true,
        fileName: 'pre-commit',
      },
      {
        name: 'pre-push',
        enabled: false,
        hasContent: false,
        fileName: 'pre-push',
      },
    ],
    onRefresh: jest.fn().mockResolvedValue(undefined),
    onGetContent: jest.fn().mockResolvedValue('#!/bin/sh'),
    onSetContent: jest.fn().mockResolvedValue(undefined),
    onToggle: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads hook content and saves the selected hook', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitHooksCard {...props} />);

    await user.click(screen.getByRole('button', { name: 'pre-commit' }));
    await waitFor(() => {
      expect(props.onGetContent).toHaveBeenCalledWith('pre-commit');
    });
    expect(screen.getByDisplayValue('#!/bin/sh')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('#!/bin/sh'), {
      target: { value: '#!/bin/sh\necho ok' },
    });
    await user.click(screen.getByRole('button', { name: 'git.hooks.save' }));

    await waitFor(() => {
      expect(props.onSetContent).toHaveBeenCalledWith(
        'pre-commit',
        '#!/bin/sh\necho ok',
      );
    });
    expect(props.onRefresh).toHaveBeenCalled();
  });

  it('toggles a hook and clears selected content when the hook disappears', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitHooksCard {...props} />);

    await user.click(screen.getByRole('button', { name: 'pre-commit' }));
    await waitFor(() => {
      expect(screen.getByDisplayValue('#!/bin/sh')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => {
      expect(props.onToggle).toHaveBeenCalledWith('pre-commit', false);
    });

    rerender(
      <GitHooksCard
        {...props}
        hooks={[
          {
            name: 'pre-push',
            enabled: false,
            hasContent: false,
            fileName: 'pre-push',
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByDisplayValue('#!/bin/sh')).not.toBeInTheDocument();
    });
  });

  it('shows empty state and surfaces failures through toast', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { rerender } = render(<GitHooksCard {...props} hooks={[]} />);

    expect(screen.getByText('git.hooks.noHooks')).toBeInTheDocument();

    rerender(
      <GitHooksCard
        {...props}
        onGetContent={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'pre-commit' }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });
});

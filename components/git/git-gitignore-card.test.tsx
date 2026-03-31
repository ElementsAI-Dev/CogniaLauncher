import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitGitignoreCard } from './git-gitignore-card';

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

describe('GitGitignoreCard', () => {
  const createProps = () => ({
    onGetGitignore: jest.fn().mockResolvedValue('node_modules/\n'),
    onSetGitignore: jest.fn().mockResolvedValue(undefined),
    onCheckIgnore: jest.fn().mockResolvedValue(['node_modules/a']),
    onAddToGitignore: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function expectLoadedContent(value: string) {
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('git.gitignore.empty'),
      ).toHaveValue(value);
    });
  }

  it('loads gitignore content on mount and refresh', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitGitignoreCard {...props} />);

    await expectLoadedContent('node_modules/\n');
    expect(props.onGetGitignore).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'git.refresh' }));
    await waitFor(() => {
      expect(props.onGetGitignore).toHaveBeenCalledTimes(2);
    });
  });

  it('saves content, adds patterns, and checks ignore state', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<GitGitignoreCard {...props} />);

    await expectLoadedContent('node_modules/\n');

    await user.click(screen.getByRole('button', { name: 'git.gitignore.save' }));
    await waitFor(() => {
      expect(props.onSetGitignore).toHaveBeenCalledWith('node_modules/\n');
    });

    await user.type(
      screen.getByPlaceholderText('git.gitignore.addPattern'),
      '  dist/  ',
    );
    await user.click(screen.getAllByRole('button', { name: 'git.gitignore.addPattern' })[0]);
    await waitFor(() => {
      expect(props.onAddToGitignore).toHaveBeenCalledWith(['dist/']);
    });

    await user.type(
      screen.getByPlaceholderText('git.gitignore.checkPlaceholder'),
      '  node_modules/a  ',
    );
    await user.click(screen.getByRole('button', { name: 'git.gitignore.checkFile' }));
    await waitFor(() => {
      expect(props.onCheckIgnore).toHaveBeenCalledWith(['node_modules/a']);
    });
    expect(screen.getByText('git.gitignore.ignored')).toBeInTheDocument();
  });

  it('shows non-ignored results and failure toasts', async () => {
    const props = createProps();
    props.onCheckIgnore.mockRejectedValueOnce(new Error('boom'));

    render(<GitGitignoreCard {...props} />);

    await expectLoadedContent('node_modules/\n');

    fireEvent.change(screen.getByPlaceholderText('git.gitignore.checkPlaceholder'), {
      target: { value: 'README.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'git.gitignore.checkFile' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: boom');
    });
  });

  it('renders the not-ignored badge and surfaces refresh failures', async () => {
    const user = userEvent.setup();
    const props = createProps();

    const { unmount } = render(
      <GitGitignoreCard
        {...props}
        onGetGitignore={jest.fn().mockRejectedValue(new Error('refresh failed'))}
      />,
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error: refresh failed');
    });

    unmount();

    render(
      <GitGitignoreCard
        {...props}
        onCheckIgnore={jest.fn().mockResolvedValue([])}
      />,
    );

    await expectLoadedContent('node_modules/\n');
    await user.type(
      screen.getByPlaceholderText('git.gitignore.checkPlaceholder'),
      'README.md',
    );
    await user.click(screen.getByRole('button', { name: 'git.gitignore.checkFile' }));

    await waitFor(() => {
      expect(screen.getByText('git.gitignore.notIgnored')).toBeInTheDocument();
    });
  });
});

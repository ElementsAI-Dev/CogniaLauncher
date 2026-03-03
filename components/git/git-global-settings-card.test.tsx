import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GitGlobalSettingsCard } from './git-global-settings-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('GitGlobalSettingsCard', () => {
  const mockGetConfigValue = jest.fn().mockResolvedValue(null);
  const mockSetConfig = jest.fn().mockResolvedValue(undefined);
  const mockSetConfigIfUnset = jest.fn().mockResolvedValue(false);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfigValue.mockImplementation((key: string) => {
      const values: Record<string, string | null> = {
        'user.name': 'John Doe',
        'user.email': 'john@example.com',
        'core.autocrlf': 'true',
        'commit.gpgsign': 'true',
        'init.defaultBranch': 'main',
        'pull.rebase': 'true',
      };
      return Promise.resolve(values[key] ?? null);
    });
  });

  it('renders loading state initially', () => {
    mockGetConfigValue.mockImplementation(() => new Promise(() => {}));
    render(
      <GitGlobalSettingsCard
        onGetConfigValue={mockGetConfigValue}
        onSetConfig={mockSetConfig}
      />,
    );
    expect(screen.getByText('git.settings.title')).toBeInTheDocument();
  });

  it('renders settings title after loading', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText('git.settings.title').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('loads all settings on mount', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });
    await waitFor(() => {
      expect(mockGetConfigValue).toHaveBeenCalledWith('user.name');
      expect(mockGetConfigValue).toHaveBeenCalledWith('user.email');
      expect(mockGetConfigValue).toHaveBeenCalledWith('core.autocrlf');
    });
  });

  it('renders accordion section headers', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('git.settings.group.identity')).toBeInTheDocument();
      expect(screen.getByText('git.settings.group.commit')).toBeInTheDocument();
      expect(screen.getByText('git.settings.group.core')).toBeInTheDocument();
    });
  });

  it('renders all group sections', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('git.settings.group.pullPush')).toBeInTheDocument();
      expect(screen.getByText('git.settings.group.diffMerge')).toBeInTheDocument();
      expect(screen.getByText('git.settings.group.credential')).toBeInTheDocument();
      expect(screen.getByText('git.settings.group.colorGpg')).toBeInTheDocument();
    });
  });

  it('renders setting labels', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('git.settings.user_name')).toBeInTheDocument();
      expect(screen.getByText('git.settings.user_email')).toBeInTheDocument();
    });
  });

  it('displays loaded config values in text inputs', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('git.settings.user_name')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    const nameInput = inputs.find(
      (i) => (i as HTMLInputElement).value === 'John Doe',
    );
    expect(nameInput).toBeInTheDocument();
    const emailInput = inputs.find(
      (i) => (i as HTMLInputElement).value === 'john@example.com',
    );
    expect(emailInput).toBeInTheDocument();
  });

  it('calls onSetConfig on toggle change', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('git.settings.commit_gpgsign')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('switch');
    if (switches.length > 0) {
      fireEvent.click(switches[0]);
      await waitFor(() => {
        expect(mockSetConfig).toHaveBeenCalled();
      });
    }
  });

  it('applies safe defaults through setConfigIfUnset', async () => {
    render(
      <GitGlobalSettingsCard
        onGetConfigValue={mockGetConfigValue}
        onSetConfig={mockSetConfig}
        onSetConfigIfUnset={mockSetConfigIfUnset}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'git.settings.applySafeDefaults' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'git.settings.applySafeDefaults' }));

    await waitFor(() => {
      expect(mockSetConfigIfUnset).toHaveBeenCalledWith('init.defaultBranch', 'main');
      expect(mockSetConfigIfUnset).toHaveBeenCalledWith('push.default', 'simple');
      expect(mockSetConfigIfUnset).toHaveBeenCalledWith('push.autoSetupRemote', 'true');
      expect(mockSetConfigIfUnset).toHaveBeenCalledWith('fetch.prune', 'true');
    });
  });
});

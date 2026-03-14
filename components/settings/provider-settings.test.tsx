import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderSettings } from './provider-settings';

const mockProviderList = jest.fn();

jest.mock('@/lib/tauri', () => ({
  providerList: () => mockProviderList(),
}));

const mockT = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    'settings.providerSettings': 'Provider Settings',
    'settings.providerSettingsDesc': 'Control provider state and priority',
    'settings.providerSearch': 'Search providers',
    'settings.providerSettingsHint': 'Provider settings use structured provider-scoped controls.',
    'settings.providerEnabledLabel': `Enable ${params?.name ?? ''}`.trim(),
    'settings.providerPriorityLabel': `Priority for ${params?.name ?? ''}`.trim(),
    'settings.providerId': 'Provider ID',
    'settings.providerPriorityPlaceholder': 'Use runtime default',
    'settings.providerLoading': 'Loading providers...',
    'settings.providerLoadError': 'Failed to load providers',
  };
  return translations[key] || key;
};

describe('ProviderSettings', () => {
  const providers = [
    {
      id: 'npm',
      display_name: 'npm',
      capabilities: ['install', 'search'],
      platforms: ['windows', 'linux', 'macos'],
      priority: 100,
      is_environment_provider: false,
      enabled: true,
    },
    {
      id: 'nvm',
      display_name: 'Node Version Manager',
      capabilities: ['install'],
      platforms: ['linux', 'macos'],
      priority: 90,
      is_environment_provider: true,
      enabled: false,
    },
  ];

  const defaultProps = {
    localConfig: {},
    savedConfig: {},
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProviderList.mockResolvedValue(providers);
  });

  it('renders structured provider rows from provider list', async () => {
    render(<ProviderSettings {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('npm')).toBeInTheDocument();
      expect(screen.getByText('Node Version Manager')).toBeInTheDocument();
    });
  });

  it('uses provider-scoped enabled controls', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();
    render(<ProviderSettings {...defaultProps} onValueChange={onValueChange} />);

    const toggle = await screen.findByRole('switch', { name: 'Enable npm' });
    await user.click(toggle);

    expect(onValueChange).toHaveBeenCalledWith('providers.npm.enabled', 'false');
  });

  it('uses provider-scoped priority controls', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();
    function Harness() {
      const [localConfig, setLocalConfig] = React.useState<Record<string, string>>({});
      return (
        <ProviderSettings
          {...defaultProps}
          localConfig={localConfig}
          onValueChange={(key, value) => {
            onValueChange(key, value);
            setLocalConfig((prev) => ({ ...prev, [key]: value }));
          }}
        />
      );
    }

    render(<Harness />);

    const input = await screen.findByLabelText('Priority for npm');
    await user.clear(input);
    await user.type(input, '120');

    expect(onValueChange).toHaveBeenLastCalledWith('providers.npm.priority', '120');
  });

  it('prefers local config overrides over fetched provider defaults', async () => {
    render(
      <ProviderSettings
        {...defaultProps}
        localConfig={{
          'providers.npm.enabled': 'false',
          'providers.npm.priority': '120',
        }}
      />,
    );

    const toggle = await screen.findByRole('switch', { name: 'Enable npm' });
    const input = await screen.findByLabelText('Priority for npm');

    expect(toggle).not.toBeChecked();
    expect(input).toHaveValue('120');
  });

  it('refreshes fetched provider defaults when provider overrides are cleared', async () => {
    mockProviderList
      .mockResolvedValueOnce([
        {
          ...providers[0],
          enabled: false,
          priority: 120,
        },
        providers[1],
      ])
      .mockResolvedValueOnce([
        {
          ...providers[0],
          enabled: true,
          priority: 80,
        },
        providers[1],
      ]);

    const { rerender } = render(
      <ProviderSettings
        {...defaultProps}
        localConfig={{
          'providers.npm.enabled': 'false',
          'providers.npm.priority': '120',
        }}
        savedConfig={{
          'providers.npm.enabled': 'false',
          'providers.npm.priority': '120',
        }}
      />,
    );

    expect(await screen.findByRole('switch', { name: 'Enable npm' })).not.toBeChecked();
    expect(await screen.findByLabelText('Priority for npm')).toHaveValue('120');

    rerender(<ProviderSettings {...defaultProps} localConfig={{}} savedConfig={{}} />);

    await waitFor(() => {
      expect(mockProviderList).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('switch', { name: 'Enable npm' })).toBeChecked();
      expect(screen.getByLabelText('Priority for npm')).toHaveValue('80');
    });
  });
});

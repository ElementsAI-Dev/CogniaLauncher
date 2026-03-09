import { render, screen } from '@testing-library/react';
import { TerminalProxySettings } from './terminal-proxy-settings';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const defaultProps = {
  proxyEnvVars: [] as [string, string][],
  proxyMode: 'global' as const,
  globalProxy: '',
  customProxy: '',
  noProxy: '',
  saving: false,
  onProxyModeChange: jest.fn(),
  onCustomProxyChange: jest.fn(),
  onCustomProxyBlur: jest.fn(),
  onNoProxyChange: jest.fn(),
  onNoProxyBlur: jest.fn(),
};

describe('TerminalProxySettings', () => {
  it('renders proxy settings card', () => {
    render(
      <TerminalProxySettings
        {...defaultProps}
        proxyEnvVars={[
          ['HTTP_PROXY', 'http://proxy:8080'],
          ['HTTPS_PROXY', 'http://proxy:8080'],
        ]}
      />,
    );

    expect(screen.getByText('terminal.proxySettings')).toBeInTheDocument();
  });

  it('shows active proxy variables', () => {
    render(
      <TerminalProxySettings
        {...defaultProps}
        proxyEnvVars={[
          ['HTTP_PROXY', 'http://proxy:8080'],
        ]}
      />,
    );

    expect(screen.getByText('HTTP_PROXY')).toBeInTheDocument();
    expect(screen.getByText('http://proxy:8080')).toBeInTheDocument();
  });

  it('shows no proxy message when empty', () => {
    render(
      <TerminalProxySettings {...defaultProps} />,
    );

    expect(screen.getByText('terminal.noActiveProxy')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <TerminalProxySettings {...defaultProps} loading />,
    );

    expect(screen.queryByText('terminal.noActiveProxy')).not.toBeInTheDocument();
  });

  it('shows noGlobalProxy message in default global mode', () => {
    render(
      <TerminalProxySettings {...defaultProps} />,
    );

    expect(screen.getByText('terminal.noGlobalProxy')).toBeInTheDocument();
  });

  it('renders no-proxy input in global mode', () => {
    render(
      <TerminalProxySettings {...defaultProps} />,
    );

    expect(screen.getByLabelText('terminal.noProxyList')).toBeInTheDocument();
  });

  it('shows sync error state and retry action', () => {
    const onRetrySync = jest.fn();
    render(
      <TerminalProxySettings
        {...defaultProps}
        syncStatus="error"
        syncMessage="Save failed"
        onRetrySync={onRetrySync}
      />,
    );

    expect(screen.getByText('Save failed')).toBeInTheDocument();
    screen.getByRole('button', { name: /common\.refresh/i }).click();
    expect(onRetrySync).toHaveBeenCalledTimes(1);
  });

  it('shows sync success state and clear action', () => {
    const onClearSyncState = jest.fn();
    render(
      <TerminalProxySettings
        {...defaultProps}
        syncStatus="success"
        syncMessage="Saved"
        onClearSyncState={onClearSyncState}
      />,
    );

    expect(screen.getByText('Saved')).toBeInTheDocument();
    screen.getByRole('button', { name: /common\.clear/i }).click();
    expect(onClearSyncState).toHaveBeenCalledTimes(1);
  });

  it('shows sync loading state', () => {
    render(
      <TerminalProxySettings
        {...defaultProps}
        syncStatus="loading"
      />,
    );

    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('disables inputs while saving', () => {
    render(
      <TerminalProxySettings
        {...defaultProps}
        proxyMode="custom"
        saving
      />,
    );

    expect(screen.getByLabelText('terminal.customProxyUrl')).toBeDisabled();
    expect(screen.getByLabelText('terminal.noProxyList')).toBeDisabled();
  });
});

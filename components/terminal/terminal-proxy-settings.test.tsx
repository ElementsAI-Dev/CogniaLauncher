import { render, screen } from '@testing-library/react';
import { TerminalProxySettings } from './terminal-proxy-settings';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('TerminalProxySettings', () => {
  it('renders proxy settings card', () => {
    render(
      <TerminalProxySettings
        proxyEnvVars={[
          ['HTTP_PROXY', 'http://proxy:8080'],
          ['HTTPS_PROXY', 'http://proxy:8080'],
        ]}
        onFetchProxyEnvVars={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.proxySettings')).toBeInTheDocument();
  });

  it('shows active proxy variables', () => {
    render(
      <TerminalProxySettings
        proxyEnvVars={[
          ['HTTP_PROXY', 'http://proxy:8080'],
        ]}
        onFetchProxyEnvVars={jest.fn()}
      />,
    );

    expect(screen.getByText('HTTP_PROXY')).toBeInTheDocument();
    expect(screen.getByText('http://proxy:8080')).toBeInTheDocument();
  });

  it('shows no proxy message when empty', () => {
    render(
      <TerminalProxySettings
        proxyEnvVars={[]}
        onFetchProxyEnvVars={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noActiveProxy')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <TerminalProxySettings
        proxyEnvVars={[]}
        onFetchProxyEnvVars={jest.fn()}
        loading
      />,
    );

    expect(screen.queryByText('terminal.noActiveProxy')).not.toBeInTheDocument();
  });
});

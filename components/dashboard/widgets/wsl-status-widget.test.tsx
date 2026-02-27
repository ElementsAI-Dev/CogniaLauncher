import { render, screen, waitFor } from '@testing-library/react';
import { WslStatusWidget } from './wsl-status-widget';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'wsl.notAvailable': 'WSL is not available on this system',
        'wsl.distros': 'Distributions',
        'wsl.running': 'Running',
        'wsl.stopped': 'Stopped',
        'wsl.kernelVersion': 'Kernel Version',
        'wsl.title': 'WSL Management',
        'common.more': 'more',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('WslStatusWidget', () => {
  it('renders not available message in non-Tauri environment', async () => {
    render(<WslStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('WSL is not available on this system')).toBeInTheDocument();
    });
  });

  it('shows terminal icon in not-available state', async () => {
    const { container } = render(<WslStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('WSL is not available on this system')).toBeInTheDocument();
    });
    // Should have an SVG terminal icon
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders card container', () => {
    const { container } = render(<WslStatusWidget />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

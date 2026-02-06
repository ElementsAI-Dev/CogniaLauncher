import { render, screen } from '@testing-library/react';
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

describe('WslStatusWidget', () => {
  it('renders not available message in non-Tauri environment', () => {
    render(<WslStatusWidget />);

    expect(screen.getByText('WSL is not available on this system')).toBeInTheDocument();
  });
});

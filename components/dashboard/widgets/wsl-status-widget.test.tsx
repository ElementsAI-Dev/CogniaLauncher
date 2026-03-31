import { render, screen } from '@testing-library/react';
import { WslStatusWidget } from './wsl-status-widget';
import { useWslStore } from '@/lib/stores/wsl';

const mockUseWslStatus = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.loading': 'Loading...',
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

jest.mock('@/hooks/wsl/use-wsl-status', () => ({
  useWslStatus: () => mockUseWslStatus(),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('WslStatusWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWslStore.setState({
      overviewContext: { tab: 'installed', tag: null, origin: 'overview' },
    });
    mockUseWslStatus.mockReturnValue({
      available: false,
      distros: [],
      status: null,
      runningCount: 0,
      completeness: { state: 'unavailable', available: false, distroCount: 0, runningCount: 0, degradedReasons: [] },
      runtimeSnapshot: null,
    });
  });

  it('renders loading state when availability is unresolved', () => {
    mockUseWslStatus.mockReturnValue({
      available: null,
      distros: [],
      status: null,
      runningCount: 0,
      completeness: { state: 'degraded', available: false, distroCount: 0, runningCount: 0, degradedReasons: [] },
      runtimeSnapshot: null,
    });

    render(<WslStatusWidget />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders not available message when WSL is unavailable', () => {
    render(<WslStatusWidget />);
    expect(screen.getByText('WSL is not available on this system')).toBeInTheDocument();
  });

  it('renders runtime snapshot reason when unavailable reason is provided', () => {
    mockUseWslStatus.mockReturnValue({
      available: false,
      distros: [],
      status: null,
      runningCount: 0,
      completeness: { state: 'unavailable', available: false, distroCount: 0, runningCount: 0, degradedReasons: [] },
      runtimeSnapshot: {
        state: 'unavailable',
        available: false,
        reasonCode: 'runtime_unavailable',
        reason: 'WSL runtime could not be detected by any probe.',
        runtimeProbes: [],
        statusProbe: { ready: false, reasonCode: 'runtime_unavailable' },
        capabilityProbe: { ready: false, reasonCode: 'runtime_unavailable' },
        distroProbe: { ready: false, reasonCode: 'runtime_unavailable' },
        distroCount: 0,
        degradedReasons: ['WSL runtime could not be detected by any probe.'],
      },
    });

    render(<WslStatusWidget />);
    expect(screen.getByText('WSL runtime could not be detected by any probe.')).toBeInTheDocument();
  });

  it('renders loaded metrics when WSL is available', () => {
    mockUseWslStatus.mockReturnValue({
      available: true,
      distros: [
        { name: 'Ubuntu', state: 'Running', wslVersion: 2, isDefault: true },
        { name: 'Debian', state: 'Stopped', wslVersion: 2, isDefault: false },
      ],
      status: { defaultVersion: 2, kernelVersion: '5.15.0', version: '2.2.4' },
      runningCount: 1,
      completeness: { state: 'ready', available: true, distroCount: 2, runningCount: 1, degradedReasons: [] },
      runtimeSnapshot: null,
    });

    render(<WslStatusWidget />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Ubuntu')).toBeInTheDocument();
  });

  it('renders card container', () => {
    const { container } = render(<WslStatusWidget />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('builds widget entry link with widget origin', () => {
    mockUseWslStatus.mockReturnValue({
      available: true,
      distros: [],
      status: { defaultVersion: 2, kernelVersion: '5.15.0', version: '2.2.4' },
      runningCount: 0,
      completeness: { state: 'empty', available: true, distroCount: 0, runningCount: 0, degradedReasons: [] },
      runtimeSnapshot: null,
    });

    render(<WslStatusWidget />);

    expect(screen.getByRole('link', { name: 'WSL Management' })).toHaveAttribute(
      'href',
      '/wsl?origin=widget'
    );
  });
});

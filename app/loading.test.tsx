import { render } from '@testing-library/react';
import DashboardLoading from './loading';
import AboutLoading from './about/loading';
import CacheLoading from './cache/loading';
import CacheTypeLoading from './cache/[cacheType]/loading';
import DocsLoading from './docs/[[...slug]]/loading';
import DownloadsLoading from './downloads/loading';
import EnvironmentsLoading from './environments/loading';
import EnvTypeLoading from './environments/[envType]/loading';
import EnvVarLoading from './envvar/loading';
import GitLoading from './git/loading';
import LogsLoading from './logs/loading';
import PackagesLoading from './packages/loading';
import PackageDetailLoading from './packages/detail/loading';
import ProvidersLoading from './providers/loading';
import ProviderIdLoading from './providers/[id]/loading';
import SettingsLoading from './settings/loading';
import TerminalLoading from './terminal/loading';
import WslLoading from './wsl/loading';
import WslDistroLoading from './wsl/distro/loading';

jest.mock('@/components/layout/page-loading-skeleton', () => ({
  PageLoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid="skeleton" data-variant={variant}>Loading</div>
  ),
}));

describe('Loading skeletons', () => {
  it('app/loading.tsx renders dashboard skeleton', () => {
    const { container } = render(<DashboardLoading />);
    expect(container.querySelector('[data-variant="dashboard"]')).toBeInTheDocument();
  });

  it('app/about/loading.tsx renders detail skeleton', () => {
    const { container } = render(<AboutLoading />);
    expect(container.querySelector('[data-variant="detail"]')).toBeInTheDocument();
  });

  it('app/cache/loading.tsx renders skeleton', () => {
    const { container } = render(<CacheLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/cache/[cacheType]/loading.tsx renders skeleton', () => {
    const { container } = render(<CacheTypeLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/docs/[[...slug]]/loading.tsx renders skeleton', () => {
    const { container } = render(<DocsLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/downloads/loading.tsx renders skeleton', () => {
    const { container } = render(<DownloadsLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/environments/loading.tsx renders skeleton', () => {
    const { container } = render(<EnvironmentsLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/environments/[envType]/loading.tsx renders skeleton', () => {
    const { container } = render(<EnvTypeLoading />);
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('app/envvar/loading.tsx renders skeleton', () => {
    const { container } = render(<EnvVarLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/git/loading.tsx renders tabs skeleton', () => {
    const { container } = render(<GitLoading />);
    expect(container.querySelector('[data-variant="tabs"]')).toBeInTheDocument();
  });

  it('app/logs/loading.tsx renders skeleton', () => {
    const { container } = render(<LogsLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/packages/loading.tsx renders skeleton', () => {
    const { container } = render(<PackagesLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/packages/detail/loading.tsx renders skeleton', () => {
    const { container } = render(<PackageDetailLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/providers/loading.tsx renders skeleton', () => {
    const { container } = render(<ProvidersLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/providers/[id]/loading.tsx renders skeleton', () => {
    const { container } = render(<ProviderIdLoading />);
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('app/settings/loading.tsx renders skeleton', () => {
    const { container } = render(<SettingsLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/terminal/loading.tsx renders skeleton', () => {
    const { container } = render(<TerminalLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/wsl/loading.tsx renders skeleton', () => {
    const { container } = render(<WslLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('app/wsl/distro/loading.tsx renders skeleton', () => {
    const { container } = render(<WslDistroLoading />);
    expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });
});

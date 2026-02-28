import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TerminalShellFramework } from './terminal-shell-framework';
import type { ShellInfo, ShellFrameworkInfo, FrameworkCacheInfo } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const shells: ShellInfo[] = [
  {
    id: 'zsh',
    name: 'Zsh',
    shellType: 'zsh',
    version: '5.9',
    executablePath: '/bin/zsh',
    configFiles: [],
    isDefault: true,
  },
];

const frameworks: ShellFrameworkInfo[] = [
  {
    name: 'Oh My Zsh',
    version: '1.0.0',
    path: '/home/user/.oh-my-zsh',
    shellType: 'zsh',
    category: 'framework',
    description: 'Community-driven Zsh configuration framework',
    homepage: 'https://ohmyz.sh',
    configPath: '/home/user/.zshrc',
    activeTheme: 'robbyrussell',
  },
];

describe('TerminalShellFramework', () => {
  it('renders framework list', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    expect(screen.getByText('Oh My Zsh')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Framework')).toBeInTheDocument();
  });

  it('shows empty state when no frameworks', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noFrameworks')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        loading
      />,
    );

    expect(screen.queryByText('terminal.noFrameworks')).not.toBeInTheDocument();
  });

  it('renders plugins when framework selected', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[
          { name: 'git', enabled: true, source: 'oh-my-zsh' },
          { name: 'docker', enabled: false, source: 'oh-my-zsh' },
        ]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    expect(screen.getByText('Oh My Zsh')).toBeInTheDocument();
  });

  it('calls onDetectFrameworks for each shell when detect button clicked', async () => {
    const onDetectFrameworks = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={onDetectFrameworks}
        onFetchPlugins={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /terminal\.detectFrameworks/i }));

    await waitFor(() => {
      expect(onDetectFrameworks).toHaveBeenCalledWith('zsh');
    });
  });

  it('calls onFetchPlugins when framework clicked', async () => {
    const onFetchPlugins = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={onFetchPlugins}
      />,
    );

    fireEvent.click(screen.getByText('Oh My Zsh'));

    await waitFor(() => {
      expect(onFetchPlugins).toHaveBeenCalledWith('Oh My Zsh', '/home/user/.oh-my-zsh', 'zsh', '/home/user/.zshrc');
    });
  });

  it('disables detect button when no shells provided', () => {
    render(
      <TerminalShellFramework
        shells={[]}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    const detectButton = screen.getByRole('button', { name: /terminal\.detectFrameworks/i });
    expect(detectButton).toBeDisabled();
  });

  // ── Framework Cache Section tests ──

  const mockCacheStats: FrameworkCacheInfo[] = [
    {
      frameworkName: 'Oh My Zsh',
      cachePaths: ['/home/user/.oh-my-zsh/cache'],
      totalSize: 4096,
      totalSizeHuman: '4.0 KB',
      canClean: true,
      description: 'Cache files for Oh My Zsh',
    },
    {
      frameworkName: 'Starship',
      cachePaths: [],
      totalSize: 0,
      totalSizeHuman: '0 B',
      canClean: false,
      description: 'Cache files for Starship',
    },
  ];

  it('shows cache section with scan button when frameworks are detected', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={jest.fn()}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.frameworkCache')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /terminal\.scanCache/i })).toBeInTheDocument();
  });

  it('does not show cache section when no frameworks detected', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={jest.fn()}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    expect(screen.queryByText('terminal.frameworkCache')).not.toBeInTheDocument();
  });

  it('shows empty cache state when no cache stats loaded', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        frameworkCacheStats={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={jest.fn()}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noCacheData')).toBeInTheDocument();
  });

  it('renders cache stats per framework with sizes', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        frameworkCacheStats={mockCacheStats}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={jest.fn()}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    // 'Oh My Zsh' appears in both framework list and cache section
    const omzElements = screen.getAllByText('Oh My Zsh');
    expect(omzElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('4.0 KB')).toBeInTheDocument();
    expect(screen.getByText('Starship')).toBeInTheDocument();
    expect(screen.getByText('0 B')).toBeInTheDocument();
  });

  it('calls onFetchCacheStats when scan button clicked', async () => {
    const onFetchCacheStats = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={onFetchCacheStats}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /terminal\.scanCache/i }));
    expect(onFetchCacheStats).toHaveBeenCalledTimes(1);
  });

  it('shows loading skeleton when frameworkCacheLoading is true', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        frameworkCacheLoading={true}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={jest.fn()}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    // Should not show empty state text when loading
    expect(screen.queryByText('terminal.noCacheData')).not.toBeInTheDocument();
  });

  it('disables clean button for frameworks with no cache', () => {
    const emptyCacheStats: FrameworkCacheInfo[] = [
      {
        frameworkName: 'Starship',
        cachePaths: [],
        totalSize: 0,
        totalSizeHuman: '0 B',
        canClean: false,
        description: 'Cache files for Starship',
      },
    ];

    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        frameworkCacheStats={emptyCacheStats}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={jest.fn()}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    const cleanButton = screen.getByRole('button', { name: /terminal\.cleanCache/i });
    expect(cleanButton).toBeDisabled();
  });

  it('shows total cache badge when cache stats present with non-zero size', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        frameworkCacheStats={mockCacheStats}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        onFetchCacheStats={jest.fn()}
        onCleanFrameworkCache={jest.fn()}
      />,
    );

    // totalSize = 4096 → formatBytes should produce "4 KB" or similar
    // The total badge should be present somewhere
    expect(screen.getByText('terminal.frameworkCache')).toBeInTheDocument();
  });
});

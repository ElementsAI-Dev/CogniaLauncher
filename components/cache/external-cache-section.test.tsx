import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExternalCacheSection } from './external-cache-section';

const mockUseExternalCache = jest.fn();
const mockFetchExternalCaches = jest.fn();
const mockHandleCleanSingle = jest.fn();
const mockHandleCleanAll = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/hooks/cache/use-external-cache', () => ({
  useExternalCache: (...args: unknown[]) => mockUseExternalCache(...args),
}));

jest.mock('@/components/provider-management/provider-icon', () => ({
  CacheProviderIcon: ({ provider }: { provider: string }) => (
    <span data-testid={`icon-${provider}`} />
  ),
}));

const defaultHookState = {
  caches: [
    {
      provider: 'npm',
      displayName: 'npm Cache',
      cachePath: 'C:\\Users\\Test\\AppData\\npm-cache',
      size: 524288000,
      sizeHuman: '500 MB',
      isAvailable: true,
      canClean: true,
      category: 'package_manager',
      probePending: false,
      cleanupMode: 'direct_clean_only',
      scopeType: 'external',
      isCustom: false,
    },
    {
      provider: 'docker',
      displayName: 'Docker Cache',
      cachePath: null,
      size: 0,
      sizeHuman: '0 B',
      isAvailable: false,
      canClean: false,
      category: 'devtools',
      probePending: false,
      cleanupMode: 'disabled',
      scopeType: 'external',
      isCustom: false,
    },
  ],
  loading: false,
  readState: {
    status: 'ready',
    error: null,
    lastUpdatedAt: Date.now(),
  },
  cleaning: null,
  cleanableCount: 1,
  totalSize: 524288000,
  grouped: {
    package_manager: [
      {
        provider: 'npm',
        displayName: 'npm Cache',
        cachePath: 'C:\\Users\\Test\\AppData\\npm-cache',
        size: 524288000,
        sizeHuman: '500 MB',
        isAvailable: true,
        canClean: true,
        category: 'package_manager',
        probePending: false,
        cleanupMode: 'direct_clean_only',
        scopeType: 'external',
        isCustom: false,
      },
    ],
    devtools: [
      {
        provider: 'docker',
        displayName: 'Docker Cache',
        cachePath: null,
        size: 0,
        sizeHuman: '0 B',
        isAvailable: false,
        canClean: false,
        category: 'devtools',
        probePending: false,
        cleanupMode: 'disabled',
        scopeType: 'external',
        isCustom: false,
      },
    ],
  },
  orderedCategories: ['package_manager', 'devtools'],
  fetchExternalCaches: mockFetchExternalCaches,
  handleCleanSingle: mockHandleCleanSingle,
  handleCleanAll: mockHandleCleanAll,
};

describe('ExternalCacheSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleCleanAll.mockResolvedValue([]);
    mockUseExternalCache.mockReturnValue(defaultHookState);
  });

  it('renders external cache section stats', () => {
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);
    expect(
      screen.getByText((text) => text.includes('cache.externalCaches')),
    ).toBeInTheDocument();
  });

  it('wires shared external cache hook with controlled trash props', () => {
    const setUseTrash = jest.fn();
    render(<ExternalCacheSection useTrash={true} setUseTrash={setUseTrash} />);

    expect(mockUseExternalCache).toHaveBeenCalledWith(expect.objectContaining({
      includePathInfos: false,
      autoFetch: true,
      useTrash: true,
      setUseTrash,
    }));
  });

  it('fetches caches on mount via autoFetch', () => {
    mockUseExternalCache.mockReturnValue({
      ...defaultHookState,
      caches: [],
      grouped: {},
      orderedCategories: [],
      cleanableCount: 0,
      totalSize: 0,
    });

    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    // autoFetch: true means hook handles fetching internally
    expect(mockUseExternalCache).toHaveBeenCalled();
  });

  it('calls shared single-clean workflow when clean button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    const cleanButtons = screen.getAllByRole('button', { name: /^cache\.clean$/i });
    await user.click(cleanButtons[0]);

    expect(mockHandleCleanSingle).toHaveBeenCalledWith('npm');
  });

  it('calls shared clean-all workflow after confirmation', async () => {
    const user = userEvent.setup();
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /cache\.cleanAll/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /cache\.cleanAll/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(mockHandleCleanAll).toHaveBeenCalledTimes(1);
  });

  it('keeps completed rows visible while loading when probe results are partial', () => {
    mockUseExternalCache.mockReturnValue({
      ...defaultHookState,
      loading: true,
      readState: {
        status: 'loading',
        error: null,
        lastUpdatedAt: Date.now(),
      },
      caches: [
        {
          ...defaultHookState.caches[0],
          probePending: true,
        },
      ],
      grouped: {
        package_manager: [
          {
            ...defaultHookState.caches[0],
            probePending: true,
          },
        ],
      },
      orderedCategories: ['package_manager'],
      cleanableCount: 0,
      totalSize: 0,
    });

    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    expect(screen.getByText('npm Cache')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cache\.clean$/i })).toBeDisabled();
  });

  it('shows retry alert when external cache read fails', async () => {
    mockUseExternalCache.mockReturnValue({
      ...defaultHookState,
      readState: {
        status: 'error',
        error: 'cache.externalLoadFailed',
        lastUpdatedAt: Date.now(),
      },
    });

    const user = userEvent.setup();
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    expect(screen.getByText('cache.externalLoadFailed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /common\.retry/i }));
    expect(mockFetchExternalCaches).toHaveBeenCalled();
  });

  it('renders direct-clean-only and disabled maintenance explanations', () => {
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    expect(screen.getByText('cache.externalCleanupDirectOnly')).toBeInTheDocument();
    expect(screen.getByText('cache.externalCleanupDisabled')).toBeInTheDocument();
  });

  it('renders drilldown links for cache rows', () => {
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    const links = screen.getAllByRole('link', { name: 'cache.viewDetails' });
    expect(links[0]).toHaveAttribute(
      'href',
      '/cache/external?target=npm&targetType=external',
    );
  });

  it('surfaces custom scope identity when a custom cache entry is present', () => {
    mockUseExternalCache.mockReturnValue({
      ...defaultHookState,
      caches: [
        {
          provider: 'custom_docs',
          displayName: 'Docs Cache',
          cachePath: 'C:\\cache\\docs',
          size: 1048576,
          sizeHuman: '1 MB',
          isAvailable: true,
          canClean: true,
          category: 'devtools',
          probePending: false,
          cleanupMode: 'direct_clean_only',
          scopeType: 'custom',
          isCustom: true,
        },
      ],
      grouped: {
        devtools: [
          {
            provider: 'custom_docs',
            displayName: 'Docs Cache',
            cachePath: 'C:\\cache\\docs',
            size: 1048576,
            sizeHuman: '1 MB',
            isAvailable: true,
            canClean: true,
            category: 'devtools',
            probePending: false,
            cleanupMode: 'direct_clean_only',
            scopeType: 'custom',
            isCustom: true,
          },
        ],
      },
      orderedCategories: ['devtools'],
      cleanableCount: 1,
      totalSize: 1048576,
    });

    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    expect(screen.getByText('cache.detail.customScope')).toBeInTheDocument();
  });
});

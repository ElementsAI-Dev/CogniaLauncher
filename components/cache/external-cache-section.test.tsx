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

jest.mock('@/hooks/use-external-cache', () => ({
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
    },
  ],
  loading: false,
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

  it('renders external cache section title', () => {
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);
    expect(screen.getByText('cache.externalCaches')).toBeInTheDocument();
    expect(screen.getByText('cache.externalCachesDesc')).toBeInTheDocument();
  });

  it('wires shared external cache hook with controlled trash props', () => {
    const setUseTrash = jest.fn();
    render(<ExternalCacheSection useTrash={true} setUseTrash={setUseTrash} />);

    expect(mockUseExternalCache).toHaveBeenCalledWith(expect.objectContaining({
      includePathInfos: false,
      autoFetch: false,
      useTrash: true,
      setUseTrash,
    }));
  });

  it('fetches caches when section is opened and no data is loaded', async () => {
    mockUseExternalCache.mockReturnValue({
      ...defaultHookState,
      caches: [],
      grouped: {},
      orderedCategories: [],
      cleanableCount: 0,
      totalSize: 0,
    });

    const user = userEvent.setup();
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    const trigger = screen.getByTestId('external-cache-trigger');
    if (trigger) {
      await user.click(trigger);
    }

    expect(mockFetchExternalCaches).toHaveBeenCalledTimes(1);
  });

  it('calls shared single-clean workflow when clean button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    const trigger = screen.getByTestId('external-cache-trigger');
    if (trigger) {
      await user.click(trigger);
    }

    const cleanButtons = screen.getAllByRole('button', { name: /^cache\.clean$/i });
    await user.click(cleanButtons[0]);

    expect(mockHandleCleanSingle).toHaveBeenCalledWith('npm');
  });

  it('calls shared clean-all workflow after confirmation', async () => {
    const user = userEvent.setup();
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    const trigger = screen.getByTestId('external-cache-trigger');
    if (trigger) {
      await user.click(trigger);
    }

    await user.click(screen.getByRole('button', { name: /cache\.cleanAll/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /cache\.cleanAll/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(mockHandleCleanAll).toHaveBeenCalledTimes(1);
  });

  it('keeps completed rows visible while loading when probe results are partial', async () => {
    mockUseExternalCache.mockReturnValue({
      ...defaultHookState,
      loading: true,
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

    const user = userEvent.setup();
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);

    await user.click(screen.getByTestId('external-cache-trigger'));

    expect(screen.getByText('npm Cache')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cache\.clean$/i })).toBeDisabled();
  });
});

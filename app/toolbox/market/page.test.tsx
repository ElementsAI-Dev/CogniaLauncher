import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolboxMarketplacePage from './page';

const mockReplace = jest.fn();
const mockRefreshCatalog = jest.fn();
const mockInstallListing = jest.fn();
const mockUpdateListing = jest.fn();

const mockListings = [
  {
    id: 'hello-world-rust',
    pluginId: 'com.cognia.hello-world',
    name: 'Hello World',
    description: 'Rust example plugin.',
    version: '0.1.0',
    category: 'developer',
    featured: true,
    authors: [],
    minimumHostVersion: '0.1.0',
    toolContractVersion: '1.0.0',
    permissions: ['env_read'],
    capabilities: ['environment.read'],
    tools: [{ toolId: 'hello', name: 'Hello', description: 'Greets', category: 'developer', uiMode: 'text' }],
    desktopOnly: true,
    source: {
      type: 'store' as const,
      storeId: 'hello-world-rust',
      pluginDir: 'marketplace/hello-world-rust',
      artifact: 'plugin.wasm',
      checksumSha256: 'abc',
    },
    installState: 'not-installed' as const,
    blockedReason: null,
    compatible: true,
    installedPlugin: null,
    pendingUpdate: null,
  },
];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/toolbox/market',
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string, values?: Record<string, string>) => values?.timestamp ?? key }),
}));

jest.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

jest.mock('@/hooks/use-toolbox-marketplace', () => ({
  useToolboxMarketplace: () => ({
    filteredListings: mockListings,
    featuredListings: mockListings,
    recentlyUpdatedListings: mockListings,
    categories: ['developer'],
    catalogSource: 'bundled',
    syncState: 'ready',
    lastSyncedAt: '2026-03-06T12:00:00.000Z',
    lastError: null,
    refreshCatalog: mockRefreshCatalog,
    installListing: mockInstallListing,
    updateListing: mockUpdateListing,
  }),
}));

jest.mock('@/components/toolbox/marketplace-listing-card', () => ({
  MarketplaceListingCard: ({ listing }: { listing: { id: string } }) => <div data-testid={`listing-${listing.id}`} />,
}));

describe('ToolboxMarketplacePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders listings and refreshes catalog on mount', () => {
    render(<ToolboxMarketplacePage />);

    expect(screen.getByText('toolbox.marketplace.title')).toBeInTheDocument();
    expect(screen.getAllByTestId('listing-hello-world-rust').length).toBeGreaterThan(0);
    expect(mockRefreshCatalog).toHaveBeenCalledTimes(1);
  });

  it('updates query filters through router replace', () => {
    render(<ToolboxMarketplacePage />);

    fireEvent.change(screen.getByPlaceholderText('toolbox.marketplace.searchPlaceholder'), {
      target: { value: 'hello' },
    });

    expect(mockReplace).toHaveBeenCalledWith('/toolbox/market?q=hello');
  });

  it('renders curated sections and source context', () => {
    render(<ToolboxMarketplacePage />);

    expect(screen.getByText('toolbox.marketplace.featuredTitle')).toBeInTheDocument();
    expect(screen.getByText('toolbox.marketplace.recentlyUpdatedTitle')).toBeInTheDocument();
    expect(screen.getByText('toolbox.marketplace.source.bundled')).toBeInTheDocument();
  });

  it('updates sort and verified filters through router replace', () => {
    render(<ToolboxMarketplacePage />);

    fireEvent.change(screen.getByLabelText('toolbox.marketplace.sortLabel'), {
      target: { value: 'updated' },
    });
    expect(mockReplace).toHaveBeenCalledWith('/toolbox/market?sort=updated');

    fireEvent.click(screen.getByText('toolbox.marketplace.verifiedOnly'));
    expect(mockReplace).toHaveBeenCalledWith('/toolbox/market?verified=1');
  });
});

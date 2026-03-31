import { render, screen } from '@testing-library/react';
import { MarketplaceDetailPageClient } from './marketplace-detail-page-client';

const mockRefreshCatalog = jest.fn();
const mockInstallListing = jest.fn();
const mockUpdateListing = jest.fn();
let mockLastActionProgress: {
  kind: "marketplace-install" | "marketplace-update";
  listingId: string;
  pluginId: string;
  phase: "preparing" | "downloading" | "verifying" | "installing" | "completed" | "failed";
  downloadTaskId: string | null;
  timestamp: number;
} | null = null;

const mockListing = {
  id: 'hello-world-rust',
  pluginId: 'com.cognia.hello-world',
  name: 'Hello World',
  description: 'Rust example plugin.',
  version: '0.1.0',
  category: 'developer',
  featured: true,
  authors: [],
  updatedAt: '2026-03-06T00:00:00.000Z',
  installCount: 2048,
  publisher: {
    id: 'cognia',
    name: 'CogniaLauncher Team',
    verified: true,
    url: 'https://example.invalid/publisher/cognia',
  },
  support: {
    homepageUrl: 'https://example.invalid/hello-world',
    documentationUrl: 'https://example.invalid/hello-world/docs',
    issuesUrl: 'https://example.invalid/hello-world/issues',
  },
  highlights: ['Fast setup', 'Cross-runtime demo'],
  gallery: [
    {
      type: 'image' as const,
      url: 'https://example.invalid/hello-world/screenshot.png',
      alt: 'Hello World screenshot',
      caption: 'Overview',
    },
  ],
  releaseNotes: 'Adds richer environment inspection and onboarding hints.',
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
    downloadUrl: null,
    mirrorUrls: [],
    sizeBytes: null,
  },
  installState: 'not-installed' as const,
  blockedReason: null,
  compatible: true,
  installedPlugin: null,
  pendingUpdate: null,
};

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
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

jest.mock('@/hooks/toolbox/use-toolbox-marketplace', () => ({
  useToolboxMarketplace: () => ({
    getListingById: (listingId: string) => (listingId === 'hello-world-rust' ? mockListing : null),
    refreshCatalog: mockRefreshCatalog,
    installListing: mockInstallListing,
    updateListing: mockUpdateListing,
    lastActionProgress: mockLastActionProgress,
  }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('MarketplaceDetailPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastActionProgress = null;
  });

  it('renders listing detail content', () => {
    render(<MarketplaceDetailPageClient listingId="hello-world-rust" />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('toolbox.marketplace.trustAndCompatibility')).toBeInTheDocument();
    expect(screen.getByText('environment.read')).toBeInTheDocument();
    expect(screen.getByText('CogniaLauncher Team')).toBeInTheDocument();
    expect(screen.getByText('toolbox.marketplace.supportLinks')).toBeInTheDocument();
    expect(screen.getByText('Adds richer environment inspection and onboarding hints.')).toBeInTheDocument();
    expect(mockRefreshCatalog).toHaveBeenCalledTimes(1);
  });

  it('renders not-found fallback for missing listing', () => {
    render(<MarketplaceDetailPageClient listingId="missing-listing" />);

    expect(screen.getByText('toolbox.marketplace.notFound')).toBeInTheDocument();
  });

  it('shows action phase details when current listing action is in progress', () => {
    mockLastActionProgress = {
      kind: 'marketplace-update',
      listingId: 'hello-world-rust',
      pluginId: 'com.cognia.hello-world',
      phase: 'downloading',
      downloadTaskId: 'task-42',
      timestamp: Date.now(),
    };

    render(<MarketplaceDetailPageClient listingId="hello-world-rust" />);

    expect(screen.getByText(/Action: marketplace-update/)).toBeInTheDocument();
    expect(screen.getByText(/Phase: downloading/)).toBeInTheDocument();
  });
});

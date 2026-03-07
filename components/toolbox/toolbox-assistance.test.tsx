import { render, screen } from '@testing-library/react';
import { ToolboxAssistance } from './toolbox-assistance';

let mockToolboxState = {
  allTools: [],
  recentTools: [],
  favorites: [],
  excludedTools: [],
  setCategory: jest.fn(),
};

let mockMarketplaceState = {
  featuredListings: [
    {
      id: 'hello-world-rust',
      name: 'Hello World',
      description: 'Rust example plugin.',
    },
  ],
  continuationHint: null as null | {
    kind: 'marketplace-install';
    listingId: string;
    pluginId: string;
    toolId: string | null;
    timestamp: number;
  },
};

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/use-toolbox', () => ({
  useToolbox: () => mockToolboxState,
}));

jest.mock('@/hooks/use-toolbox-marketplace', () => ({
  useToolboxMarketplace: () => mockMarketplaceState,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('ToolboxAssistance', () => {
  beforeEach(() => {
    mockToolboxState = {
      allTools: [],
      recentTools: [],
      favorites: [],
      excludedTools: [],
      setCategory: jest.fn(),
    };
    mockMarketplaceState = {
      featuredListings: [
        {
          id: 'hello-world-rust',
          name: 'Hello World',
          description: 'Rust example plugin.',
        },
      ],
      continuationHint: null,
    };
  });

  it('renders cold-start guidance when there is no history', () => {
    render(<ToolboxAssistance />);

    expect(screen.getByText('toolbox.assistance.starterTitle')).toBeInTheDocument();
    expect(screen.getAllByText('toolbox.assistance.browseMarketplace').length).toBeGreaterThan(0);
  });

  it('renders continuation actions after marketplace install', () => {
    mockMarketplaceState = {
      ...mockMarketplaceState,
      continuationHint: {
        kind: 'marketplace-install',
        listingId: 'hello-world-rust',
        pluginId: 'com.cognia.hello-world',
        toolId: 'plugin:com.cognia.hello-world:hello',
        timestamp: 1234,
      },
    };

    render(<ToolboxAssistance />);

    expect(screen.getByText('toolbox.marketplace.resumeTitle')).toBeInTheDocument();
    expect(screen.getByText('toolbox.marketplace.openInstalledTool')).toBeInTheDocument();
  });
});

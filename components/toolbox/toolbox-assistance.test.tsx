import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolboxAssistance } from './toolbox-assistance';

let mockToolboxState = {
  allTools: [],
  recentTools: [],
  favorites: [],
  excludedTools: [],
  assistancePanels: {
    history: { collapsed: false, hidden: false },
    featured: { collapsed: false, hidden: false },
  },
  setAssistancePanelCollapsed: jest.fn(),
  hideAssistancePanel: jest.fn(),
  restoreAssistancePanel: jest.fn(),
  restoreAllAssistancePanels: jest.fn(),
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

jest.mock('@/hooks/toolbox/use-toolbox', () => ({
  useToolbox: () => mockToolboxState,
}));

jest.mock('@/hooks/toolbox/use-toolbox-marketplace', () => ({
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
      assistancePanels: {
        history: { collapsed: false, hidden: false },
        featured: { collapsed: false, hidden: false },
      },
      setAssistancePanelCollapsed: jest.fn(),
      hideAssistancePanel: jest.fn(),
      restoreAssistancePanel: jest.fn(),
      restoreAllAssistancePanels: jest.fn(),
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
    expect(screen.getByTestId('toolbox-assistance-history')).toBeInTheDocument();
    expect(screen.getByTestId('toolbox-assistance-featured')).toBeInTheDocument();
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

  it('toggles panel collapsed state via header control', () => {
    render(<ToolboxAssistance />);

    fireEvent.click(screen.getByTestId('toolbox-assistance-toggle-history'));

    expect(mockToolboxState.setAssistancePanelCollapsed).toHaveBeenCalledWith('history', true);
  });

  it('hides featured panel via header action', () => {
    render(<ToolboxAssistance />);

    fireEvent.click(screen.getByTestId('toolbox-assistance-hide-featured'));

    expect(mockToolboxState.hideAssistancePanel).toHaveBeenCalledWith('featured');
  });

  it('does not render hidden panels', () => {
    mockToolboxState = {
      ...mockToolboxState,
      assistancePanels: {
        history: { collapsed: false, hidden: true },
        featured: { collapsed: false, hidden: false },
      },
    };

    render(<ToolboxAssistance />);

    expect(screen.queryByTestId('toolbox-assistance-history')).not.toBeInTheDocument();
    expect(screen.getByTestId('toolbox-assistance-featured')).toBeInTheDocument();
  });

  it('supports keyboard activation on panel controls', async () => {
    const user = userEvent.setup();
    render(<ToolboxAssistance />);

    const toggle = screen.getByTestId('toolbox-assistance-toggle-history');
    toggle.focus();
    await user.keyboard('{Enter}');

    expect(mockToolboxState.setAssistancePanelCollapsed).toHaveBeenCalledWith('history', true);
  });
});

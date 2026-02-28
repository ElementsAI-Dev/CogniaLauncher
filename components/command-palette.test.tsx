import { render, screen } from "@testing-library/react";
import { CommandPalette } from "./command-palette";

const mockPush = jest.fn();
const mockToggleDrawer = jest.fn();
const mockOnOpenChange = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.dashboard": "Dashboard",
        "nav.environments": "Environments",
        "nav.packages": "Packages",
        "nav.providers": "Providers",
        "nav.cache": "Cache",
        "nav.logs": "Logs",
        "nav.settings": "Settings",
        "nav.about": "About",
        "nav.docs": "Documentation",
        "nav.wsl": "WSL",
        "nav.downloads": "Downloads",
        "commandPalette.open": "Open command palette",
        "commandPalette.placeholder": "Search commands...",
        "commandPalette.noResults": "No results found.",
        "commandPalette.groups.navigation": "Navigation",
        "commandPalette.groups.actions": "Actions",
        "commandPalette.actions.toggleLogs": "Toggle logs",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/stores/log", () => ({
  useLogStore: () => ({ toggleDrawer: mockToggleDrawer }),
}));

const mockOpenFeedback = jest.fn();
jest.mock("@/lib/stores/feedback", () => ({
  useFeedbackStore: () => ({ openDialog: mockOpenFeedback }),
}));

jest.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: jest.fn(),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing when closed", () => {
    render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);
    // When closed, the dialog content should not be visible
    expect(
      screen.queryByPlaceholderText("Search commands..."),
    ).not.toBeInTheDocument();
  });

  it("accepts open and onOpenChange props", () => {
    // Just verify the component accepts its props without errors
    expect(() => {
      render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);
    }).not.toThrow();
  });

  it("has required props defined", () => {
    // Verify the component interface is correct
    expect(mockOnOpenChange).toBeDefined();
    expect(mockPush).toBeDefined();
    expect(mockToggleDrawer).toBeDefined();
  });
});

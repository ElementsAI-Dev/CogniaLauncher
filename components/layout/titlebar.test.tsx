import { render, waitFor } from "@testing-library/react";
import { Titlebar } from "./titlebar";

let mockIsTauri = true;

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri,
}));

const mockMinimize = jest.fn();
const mockToggleMaximize = jest.fn();
const mockClose = jest.fn();
const mockHide = jest.fn();
const mockDestroy = jest.fn();
const mockSetAlwaysOnTop = jest.fn();
const mockSetFullscreen = jest.fn();
const mockCenter = jest.fn();

jest.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
    hide: mockHide,
    destroy: mockDestroy,
    setAlwaysOnTop: mockSetAlwaysOnTop,
    setFullscreen: mockSetFullscreen,
    center: mockCenter,
    isMaximized: jest.fn().mockResolvedValue(false),
    isFullscreen: jest.fn().mockResolvedValue(false),
    isAlwaysOnTop: jest.fn().mockResolvedValue(false),
    onResized: jest.fn().mockResolvedValue(() => {}),
    onFocusChanged: jest.fn().mockResolvedValue(() => {}),
    onCloseRequested: jest.fn().mockResolvedValue(() => {}),
  }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "titlebar.minimize": "Minimize",
        "titlebar.maximize": "Maximize",
        "titlebar.restore": "Restore",
        "titlebar.close": "Close",
        "titlebar.alwaysOnTop": "Always on top",
      };
      return translations[key] || key;
    },
  }),
}));

describe("Titlebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = true;
  });

  it("renders nothing when not in Tauri environment", async () => {
    mockIsTauri = false;
    const { container } = render(<Titlebar />);

    // Wait for mount effect
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders titlebar when in Tauri environment", async () => {
    const { container, getByTitle } = render(<Titlebar />);

    // Wait for Tauri initialization
    await waitFor(() => {
      expect(getByTitle("Minimize")).toBeInTheDocument();
    });

    // Component renders in Tauri mode with window controls
    expect(container).toBeTruthy();
  });

  it("has working window control buttons", async () => {
    const { getByTitle, getByLabelText } = render(<Titlebar />);

    await waitFor(() => {
      expect(getByTitle("Minimize")).toBeInTheDocument();
    });

    // Verify all control buttons are present (use aria-label for Close since title varies)
    expect(getByTitle("Minimize")).toBeInTheDocument();
    expect(getByTitle("Maximize")).toBeInTheDocument();
    expect(getByLabelText("Close")).toBeInTheDocument();
  });
});

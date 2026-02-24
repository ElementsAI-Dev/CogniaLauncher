import { render, waitFor } from "@testing-library/react";
import { Titlebar } from "./titlebar";

let mockIsTauri = true;

jest.mock("@/lib/platform", () => ({
  isTauri: () => mockIsTauri,
  isWindows: () => false,
}));

jest.mock("@/lib/stores/window-state", () => ({
  useWindowStateStore: () => ({
    isMaximized: false,
    isFullscreen: false,
    isFocused: true,
    titlebarHeight: "2rem",
    setMaximized: jest.fn(),
    setFullscreen: jest.fn(),
    setFocused: jest.fn(),
    setTitlebarHeight: jest.fn(),
  }),
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
    const { container, getByLabelText } = render(<Titlebar />);

    // Titlebar now renders synchronously after mount via isTauri()
    await waitFor(() => {
      expect(getByLabelText("Minimize")).toBeInTheDocument();
    });

    // Component renders in Tauri mode with window controls
    expect(container).toBeTruthy();
  });

  it("has working window control buttons", async () => {
    const { getByLabelText } = render(<Titlebar />);

    await waitFor(() => {
      expect(getByLabelText("Minimize")).toBeInTheDocument();
    });

    // Verify all control buttons are present via aria-label
    expect(getByLabelText("Minimize")).toBeInTheDocument();
    expect(getByLabelText("Maximize")).toBeInTheDocument();
    expect(getByLabelText("Close")).toBeInTheDocument();
  });

  it("has buttons disabled before appWindow loads", async () => {
    // Temporarily make the dynamic import hang so appWindow stays null
    jest.doMock("@tauri-apps/api/window", () => ({
      getCurrentWindow: () => new Promise(() => {}), // never resolves
    }));

    const { getByLabelText } = render(<Titlebar />);

    // Titlebar renders synchronously, buttons exist but are disabled
    await waitFor(() => {
      const minimizeBtn = getByLabelText("Minimize");
      expect(minimizeBtn).toBeInTheDocument();
      expect(minimizeBtn).toBeDisabled();
    });

    // Restore original mock
    jest.dontMock("@tauri-apps/api/window");
  });
});

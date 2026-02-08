import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";

// Mock next-themes
const mockSetTheme = jest.fn();
let mockTheme = "light";

jest.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockTheme,
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(),
  configSet: jest.fn(),
}));

const tauriMocks = jest.requireMock("@/lib/tauri") as {
  isTauri: jest.Mock;
  configSet: jest.Mock;
};

// Mock locale provider
jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "theme.toggle": "Toggle theme",
        "theme.light": "Light",
        "theme.dark": "Dark",
        "theme.system": "System",
      };
      return translations[key] || key;
    },
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockTheme = "light";
    tauriMocks.isTauri.mockReturnValue(false);
    tauriMocks.configSet.mockResolvedValue(undefined);
  });

  it("renders without crashing", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("has accessible label", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Toggle theme");
  });

  it("opens dropdown menu when clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(
      await screen.findByRole("menuitemradio", { name: /light/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /dark/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /system/i }),
    ).toBeInTheDocument();
  });

  it("calls setTheme when light option is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    const lightOption = await screen.findByRole("menuitemradio", { name: /light/i });
    await user.click(lightOption);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme when dark option is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    const darkOption = await screen.findByRole("menuitemradio", { name: /dark/i });
    await user.click(darkOption);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("syncs theme to backend when running in Tauri", async () => {
    tauriMocks.isTauri.mockReturnValue(true);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    const darkOption = await screen.findByRole("menuitemradio", { name: /dark/i });
    await user.click(darkOption);

    expect(tauriMocks.configSet).toHaveBeenCalledWith(
      "appearance.theme",
      "dark",
    );
  });

  it("calls setTheme when system option is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    const systemOption = await screen.findByRole("menuitemradio", {
      name: /system/i,
    });
    await user.click(systemOption);

    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });

  it("displays sun icon for light theme toggle button", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    const sunIcon = button.querySelector(".lucide-sun");
    expect(sunIcon).toBeInTheDocument();
  });

  it("displays moon icon element in toggle button", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    const moonIcon = button.querySelector(".lucide-moon");
    expect(moonIcon).toBeInTheDocument();
  });
});

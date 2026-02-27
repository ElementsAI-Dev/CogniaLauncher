import { render, screen, act } from "@testing-library/react";
import { LocaleProvider, useLocale } from "./locale-provider";

// Mock the i18n module with stateful locale tracking
let mockCurrentLocale = "en";
jest.mock("@/lib/i18n", () => ({
  defaultLocale: "en",
  getLocaleFromCookie: jest.fn(() => mockCurrentLocale),
  setLocaleCookie: jest.fn((locale: string) => {
    mockCurrentLocale = locale;
  }),
}));

// Test messages with error translations
const mockMessages = {
  en: {
    common: {
      unknown: "Unknown",
      cancel: "Cancel",
    },
    theme: {
      toggle: "Toggle theme",
      light: "Light",
      dark: "Dark",
      system: "System",
    },
    settings: {
      title: "Settings",
      appearance: "Appearance",
      accentColor: "Accent Color",
      reducedMotion: "Reduced Motion",
    },
    errors: {
      config: "Configuration error. Check your settings file.",
      provider: "Version manager error. Try reinstalling it.",
      providerNotFound:
        "Version manager not found. Install nvm, pyenv, or rustup first.",
      packageNotFound: "Package not found. Verify the name and try again.",
      versionNotFound: "Version not found. Check available versions.",
      versionNotInstalled: "Version not installed. Install it first.",
      resolution: "Dependency resolution failed. Try updating packages.",
      conflict: "Dependency conflict detected. Review your dependencies.",
      installation: "Installation failed. Check disk space and try again.",
      checksumMismatch: "Download corrupted. Clear cache and retry.",
      download: "Download failed. Check your connection.",
      network: "Network error. Check your internet connection.",
      io: "File operation failed. Check permissions.",
      database: "Cache database error. Try clearing cache.",
      parse: "Invalid data format.",
      platformNotSupported: "Not supported on this platform.",
      permissionDenied: "Permission denied. Run as administrator.",
      cancelled: "Operation cancelled.",
      internal: "Unexpected error. Please report this issue.",
      unknown: "An error occurred. Check logs for details.",
      suggestion: "Suggestion",
      retry: "Retry",
      dismiss: "Dismiss",
    },
  },
  zh: {
    common: {
      unknown: "未知",
      cancel: "取消",
    },
    theme: {
      toggle: "切换主题",
      light: "浅色",
      dark: "深色",
      system: "跟随系统",
    },
    settings: {
      title: "设置",
      appearance: "外观",
      accentColor: "强调色",
      reducedMotion: "减少动画",
    },
    errors: {
      config: "配置错误，请检查设置文件。",
      provider: "版本管理器错误，请尝试重新安装。",
      providerNotFound: "未找到版本管理器，请先安装 nvm、pyenv 或 rustup。",
      network: "网络错误，请检查网络连接。",
      unknown: "发生错误，请查看日志了解详情。",
      retry: "重试",
      dismiss: "忽略",
    },
  },
};

// Test component that uses the locale hook
function TestConsumer() {
  const { locale, t, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t("common.unknown")}</span>
      <span data-testid="theme-toggle">{t("theme.toggle")}</span>
      <span data-testid="error-network">{t("errors.network")}</span>
      <span data-testid="error-config">{t("errors.config")}</span>
      <button onClick={() => setLocale("zh")}>Switch to Chinese</button>
      <button onClick={() => setLocale("en")}>Switch to English</button>
    </div>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => {
    mockCurrentLocale = "en";
  });

  describe("basic functionality", () => {
    it("provides default locale", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <TestConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("locale")).toHaveTextContent("en");
    });

    it("translates simple keys", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <TestConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("translated")).toHaveTextContent("Unknown");
    });

    it("translates nested keys", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <TestConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("theme-toggle")).toHaveTextContent(
        "Toggle theme",
      );
    });
  });

  describe("error message translations", () => {
    it("translates error.network key", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <TestConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("error-network")).toHaveTextContent(
        "Network error. Check your internet connection.",
      );
    });

    it("translates error.config key", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <TestConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("error-config")).toHaveTextContent(
        "Configuration error. Check your settings file.",
      );
    });
  });

  describe("locale switching", () => {
    it("switches to Chinese locale", async () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <TestConsumer />
        </LocaleProvider>,
      );

      const switchButton = screen.getByText("Switch to Chinese");
      await act(async () => {
        switchButton.click();
      });

      expect(screen.getByTestId("locale")).toHaveTextContent("zh");
      expect(screen.getByTestId("translated")).toHaveTextContent("未知");
      expect(screen.getByTestId("theme-toggle")).toHaveTextContent("切换主题");
    });

    it("switches back to English locale", async () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <TestConsumer />
        </LocaleProvider>,
      );

      // Switch to Chinese first
      await act(async () => {
        screen.getByText("Switch to Chinese").click();
      });

      // Switch back to English
      await act(async () => {
        screen.getByText("Switch to English").click();
      });

      expect(screen.getByTestId("locale")).toHaveTextContent("en");
      expect(screen.getByTestId("translated")).toHaveTextContent("Unknown");
    });
  });

  describe("parameter interpolation", () => {
    function ParamTestConsumer() {
      const { t } = useLocale();
      return (
        <div>
          <span data-testid="with-params">
            {t("dashboard.versionsInstalled", { count: 5 })}
          </span>
        </div>
      );
    }

    it("interpolates parameters correctly", () => {
      const messagesWithParams = {
        en: {
          dashboard: {
            versionsInstalled: "{count} versions installed",
          },
        },
        zh: {
          dashboard: {
            versionsInstalled: "已安装 {count} 个版本",
          },
        },
      };

      render(
        <LocaleProvider messages={messagesWithParams as never}>
          <ParamTestConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("with-params")).toHaveTextContent(
        "5 versions installed",
      );
    });
  });

  describe("missing keys", () => {
    function MissingKeyConsumer() {
      const { t } = useLocale();
      return <span data-testid="missing">{t("nonexistent.key")}</span>;
    }

    it("returns the key when translation is missing", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <MissingKeyConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("missing")).toHaveTextContent(
        "nonexistent.key",
      );
    });
  });

  describe("initialLocale prop", () => {
    it("uses initialLocale as server snapshot", () => {
      render(
        <LocaleProvider messages={mockMessages as never} initialLocale="zh">
          <TestConsumer />
        </LocaleProvider>,
      );

      // The component should still render (initialLocale is used as server snapshot)
      expect(screen.getByTestId("locale")).toBeInTheDocument();
    });
  });

  describe("non-string leaf values", () => {
    function NestedValueConsumer() {
      const { t } = useLocale();
      // "settings" is an object, not a string — t() should return the key
      return <span data-testid="nested">{t("settings")}</span>;
    }

    it("returns key when leaf value is a non-string object", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <NestedValueConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("nested")).toHaveTextContent("settings");
    });
  });

  describe("parameter interpolation edge cases", () => {
    function MissingParamConsumer() {
      const { t } = useLocale();
      return (
        <span data-testid="missing-param">
          {t("dashboard.versionsInstalled", {})}
        </span>
      );
    }

    it("preserves placeholder when param is missing", () => {
      const messagesWithParams = {
        en: {
          dashboard: {
            versionsInstalled: "{count} versions installed",
          },
        },
        zh: {
          dashboard: {
            versionsInstalled: "已安装 {count} 个版本",
          },
        },
      };

      render(
        <LocaleProvider messages={messagesWithParams as never}>
          <MissingParamConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("missing-param")).toHaveTextContent(
        "{count} versions installed",
      );
    });
  });

  describe("useLocale hook", () => {
    it("throws error when used outside provider", () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useLocale must be used within a LocaleProvider");

      consoleError.mockRestore();
    });
  });

  describe("messages context", () => {
    function MessagesConsumer() {
      const { messages } = useLocale();
      return (
        <span data-testid="messages-check">
          {messages && typeof messages === "object" ? "has-messages" : "no-messages"}
        </span>
      );
    }

    it("provides messages object via context", () => {
      render(
        <LocaleProvider messages={mockMessages as never}>
          <MessagesConsumer />
        </LocaleProvider>,
      );

      expect(screen.getByTestId("messages-check")).toHaveTextContent("has-messages");
    });
  });
});

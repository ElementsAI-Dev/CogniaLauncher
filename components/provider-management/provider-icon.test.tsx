import { render, screen } from "@testing-library/react";
import {
  ProviderIcon,
  PlatformIcon,
  LanguageIcon,
  CacheProviderIcon,
} from "./provider-icon";

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt as string} />
  ),
}));

describe("ProviderIcon", () => {
  it("renders an image for a known provider ID", () => {
    render(<ProviderIcon providerId="npm" />);
    const img = screen.getByAltText("npm");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/icons/providers/light/npm.svg");
  });

  it("renders fallback for unknown provider ID", () => {
    render(<ProviderIcon providerId="unknown-xyz" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("applies custom size", () => {
    render(<ProviderIcon providerId="npm" size={48} />);
    const img = screen.getByAltText("npm");
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
  });

  it("applies custom className", () => {
    render(<ProviderIcon providerId="npm" className="my-class" />);
    const img = screen.getByAltText("npm");
    expect(img.className).toContain("my-class");
  });

  it("maps system providers to correct icon files", () => {
    render(<ProviderIcon providerId="system-node" />);
    const img = screen.getByAltText("system-node");
    expect(img).toHaveAttribute("src", "/icons/providers/light/nvm.svg");
  });

  it("renders default size of 24 when not specified", () => {
    render(<ProviderIcon providerId="cargo" />);
    const img = screen.getByAltText("cargo");
    expect(img).toHaveAttribute("width", "24");
    expect(img).toHaveAttribute("height", "24");
  });
});

describe("PlatformIcon", () => {
  it("renders an image for a known platform", () => {
    render(<PlatformIcon platform="windows" />);
    const img = screen.getByAltText("windows");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/icons/platforms/light/windows.svg");
  });

  it("renders fallback for unknown platform", () => {
    render(<PlatformIcon platform="freebsd" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("handles case-insensitive platform names", () => {
    render(<PlatformIcon platform="Windows" />);
    const img = screen.getByAltText("Windows");
    expect(img).toHaveAttribute("src", "/icons/platforms/light/windows.svg");
  });

  it("renders default size of 20", () => {
    render(<PlatformIcon platform="linux" />);
    const img = screen.getByAltText("linux");
    expect(img).toHaveAttribute("width", "20");
  });
});

describe("LanguageIcon", () => {
  it("renders an image for a known language", () => {
    render(<LanguageIcon languageId="python" />);
    const img = screen.getByAltText("python");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/icons/languages/light/python.svg");
  });

  it("renders fallback for unknown language", () => {
    render(<LanguageIcon languageId="brainfuck" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("renders default size of 24", () => {
    render(<LanguageIcon languageId="rust" />);
    const img = screen.getByAltText("rust");
    expect(img).toHaveAttribute("width", "24");
  });
});

describe("CacheProviderIcon", () => {
  it("renders an image for a known cache provider", () => {
    render(<CacheProviderIcon provider="npm" />);
    const img = screen.getByAltText("npm");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/icons/providers/light/npm.svg");
  });

  it("renders fallback for unknown cache provider", () => {
    render(<CacheProviderIcon provider="unknown-cache" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("maps gradle to sdkman icon", () => {
    render(<CacheProviderIcon provider="gradle" />);
    const img = screen.getByAltText("gradle");
    expect(img).toHaveAttribute("src", "/icons/providers/light/sdkman.svg");
  });

  it("applies custom size and className", () => {
    render(<CacheProviderIcon provider="pip" size={32} className="extra" />);
    const img = screen.getByAltText("pip");
    expect(img).toHaveAttribute("width", "32");
    expect(img.className).toContain("extra");
  });
});

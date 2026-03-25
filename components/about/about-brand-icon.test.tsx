/* eslint-disable @next/next/no-img-element */
import { render } from "@testing-library/react";
import type { AboutBrandAsset } from "@/lib/constants/about";
import { AboutBrandIcon } from "./about-brand-icon";

const mockUseTheme = jest.fn();

jest.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    unoptimized,
    alt,
    ...props
  }: React.ComponentProps<"img"> & { unoptimized?: boolean }) => {
    void unoptimized;
    return <img {...props} alt={alt ?? ""} />;
  },
}));

const tauriAsset: AboutBrandAsset = {
  category: "brands",
  name: "tauri",
};

const githubAsset: AboutBrandAsset = {
  category: "providers",
  name: "github",
};

describe("AboutBrandIcon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ resolvedTheme: "light" });
  });

  it("renders the mapped light theme asset by default", () => {
    const { container } = render(<AboutBrandIcon asset={tauriAsset} />);
    const img = container.querySelector("img");

    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/icons/brands/light/tauri.svg");
    expect(img).toHaveAttribute("width", "20");
    expect(img).toHaveAttribute("height", "20");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("uses dark theme icon paths and forwards custom props", () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark" });

    const { container } = render(
      <AboutBrandIcon asset={githubAsset} size={32} className="custom-class" />,
    );
    const img = container.querySelector("img");

    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/icons/providers/dark/github.svg");
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
    expect(img?.className).toContain("custom-class");
  });

  it("returns null when the asset does not have a mapped file", () => {
    const { container } = render(
      <AboutBrandIcon
        asset={{
          category: "brands",
          name: "missing-brand",
        }}
      />,
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheTypesSection } from "./cache-types-section";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

const cacheInfo = {
  download_cache: {
    size_human: "1.5 GB",
    entry_count: 42,
  },
  metadata_cache: {
    size_human: "256 MB",
    entry_count: 120,
  },
  default_downloads: {
    size_human: "800 MB",
    entry_count: 14,
    is_available: false,
    location: "C:\\Users\\test\\Downloads",
  },
};

function createProps(
  overrides: Partial<React.ComponentProps<typeof CacheTypesSection>> = {},
) {
  return {
    cacheInfo,
    loading: false,
    isCleaning: false,
    cleaningType: null,
    onPreview: jest.fn(),
    previewLoading: false,
    ...overrides,
  };
}

describe("CacheTypesSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the cache type cards with their detail links", () => {
    render(<CacheTypesSection {...createProps()} />);

    expect(screen.getByText("cache.downloadCache")).toBeInTheDocument();
    expect(screen.getByText("cache.metadataCache")).toBeInTheDocument();
    expect(screen.getByText("cache.defaultDownloads")).toBeInTheDocument();
    expect(screen.getByText("1.5 GB")).toBeInTheDocument();
    const detailLinks = screen.getAllByRole("link", { name: "cache.viewDetails" });

    expect(detailLinks).toHaveLength(3);
    expect(detailLinks[0]).toHaveAttribute("href", "/cache/download");
    expect(detailLinks[1]).toHaveAttribute("href", "/cache/metadata");
    expect(detailLinks[2]).toHaveAttribute("href", "/cache/default_downloads");
  });

  it("starts a preview for an available cache type", async () => {
    const user = userEvent.setup();
    const props = createProps({
      cacheInfo: {
        ...cacheInfo,
        default_downloads: {
          ...cacheInfo.default_downloads,
          is_available: true,
        },
      },
    });

    render(<CacheTypesSection {...props} />);

    await user.click(screen.getAllByRole("button", { name: "cache.quickClean" })[0]);

    expect(props.onPreview).toHaveBeenCalledWith("downloads");
  });

  it("marks unavailable default downloads and disables quick clean", () => {
    render(<CacheTypesSection {...createProps()} />);

    expect(screen.getByText("cache.detail.externalUnavailable")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "cache.quickClean" })[2],
    ).toBeDisabled();
  });

  it("shows the active cleaning label for the matching cache type", () => {
    render(
      <CacheTypesSection
        {...createProps({
          isCleaning: true,
          cleaningType: "downloads",
        })}
      />,
    );

    expect(screen.getByText("cache.clearing")).toBeInTheDocument();
  });
});

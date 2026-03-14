import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheBrowserDialog } from "./cache-browser-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const browserEntries = [
  {
    key: "downloads/react-19.tgz",
    entry_type: "download",
    size_human: "1.2 MB",
    hit_count: 4,
  },
  {
    key: "metadata/npm/react.json",
    entry_type: "metadata",
    size_human: "8 KB",
    hit_count: 9,
  },
];

function createProps(overrides: Partial<React.ComponentProps<typeof CacheBrowserDialog>> = {}) {
  return {
    browserOpen: true,
    setBrowserOpen: jest.fn(),
    browserEntries,
    browserTotalCount: 45,
    browserLoading: false,
    browserDeleting: false,
    browserSearch: "",
    setBrowserSearch: jest.fn(),
    browserTypeFilter: "all" as const,
    setBrowserTypeFilter: jest.fn(),
    browserSortBy: "created_desc",
    setBrowserSortBy: jest.fn(),
    browserPage: 0,
    setBrowserPage: jest.fn(),
    browserSelectedKeys: new Set<string>(),
    setBrowserSelectedKeys: jest.fn(),
    browserError: null,
    useTrash: true,
    setUseTrash: jest.fn(),
    fetchBrowserEntries: jest.fn(),
    handleRetryBrowser: jest.fn(),
    handleDeleteSelectedEntries: jest.fn(),
    ...overrides,
  };
}

describe("CacheBrowserDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the empty state when there are no entries", () => {
    render(
      <CacheBrowserDialog
        {...createProps({
          browserEntries: [],
          browserTotalCount: 0,
        })}
      />,
    );

    expect(screen.getByText("cache.noEntries")).toBeInTheDocument();
  });

  it("selects every visible entry from the header checkbox", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheBrowserDialog {...props} />);

    await user.click(screen.getAllByRole("checkbox")[0]);

    const selectedKeys = props.setBrowserSelectedKeys.mock.calls.at(-1)?.[0] as
      | Set<string>
      | undefined;

    expect(selectedKeys).toBeDefined();
    expect(Array.from(selectedKeys ?? [])).toEqual(
      browserEntries.map((entry) => entry.key),
    );
  });

  it("retries loading when the error action is pressed", async () => {
    const user = userEvent.setup();
    const props = createProps({ browserError: "Load failed" });

    render(<CacheBrowserDialog {...props} />);

    await user.click(screen.getByRole("button", { name: "common.retry" }));

    expect(props.handleRetryBrowser).toHaveBeenCalledTimes(1);
  });

  it("moves to the next page and fetches entries for it", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheBrowserDialog {...props} />);

    await user.click(screen.getByRole("button", { name: "common.next" }));

    expect(props.setBrowserPage).toHaveBeenCalledWith(1);
    expect(props.fetchBrowserEntries).toHaveBeenCalledWith(false, 1);
  });

  it("confirms deletion for the selected entries", async () => {
    const user = userEvent.setup();
    const props = createProps({
      browserSelectedKeys: new Set(["downloads/react-19.tgz"]),
    });

    render(<CacheBrowserDialog {...props} />);

    await user.click(screen.getByRole("button", { name: "cache.deleteSelected" }));
    await screen.findByText("cache.deleteEntriesConfirmTitle");

    const confirmButtons = screen.getAllByRole("button", {
      name: "cache.deleteSelected",
    });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(props.handleDeleteSelectedEntries).toHaveBeenCalledTimes(1);
  });
});

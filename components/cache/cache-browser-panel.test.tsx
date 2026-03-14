import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheBrowserPanel } from "./cache-browser-panel";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const entries = [
  {
    key: "downloads/react-19.tgz",
    file_path: "C:\\cache\\downloads\\react-19.tgz",
    entry_type: "download",
    size_human: "1.2 MB",
    hit_count: 5,
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    key: "metadata/react.json",
    file_path: "C:\\cache\\metadata\\react.json",
    entry_type: "metadata",
    size_human: "8 KB",
    hit_count: 3,
    created_at: "2025-01-02T00:00:00Z",
  },
];

function createProps(overrides: Partial<React.ComponentProps<typeof CacheBrowserPanel>> = {}) {
  return {
    entries,
    totalCount: 45,
    loading: false,
    deleting: false,
    search: "",
    onSearchChange: jest.fn(),
    typeFilter: "all" as const,
    onTypeFilterChange: jest.fn(),
    sortBy: "created_desc",
    onSortByChange: jest.fn(),
    page: 0,
    onPageChange: jest.fn(),
    selectedKeys: new Set<string>(),
    onSelectedKeysChange: jest.fn(),
    error: null,
    useTrash: true,
    onUseTrashChange: jest.fn(),
    onFetchEntries: jest.fn(),
    onRetry: jest.fn(),
    onDeleteSelected: jest.fn(),
    ...overrides,
  };
}

describe("CacheBrowserPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the empty state when there are no entries", () => {
    render(
      <CacheBrowserPanel
        {...createProps({
          entries: [],
          totalCount: 0,
        })}
      />,
    );

    expect(screen.getByText("cache.noEntries")).toBeInTheDocument();
  });

  it("selects every visible entry from the header checkbox", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheBrowserPanel {...props} />);

    await user.click(screen.getAllByRole("checkbox")[0]);

    const selectedKeys = props.onSelectedKeysChange.mock.calls.at(-1)?.[0] as
      | Set<string>
      | undefined;

    expect(selectedKeys).toBeDefined();
    expect(Array.from(selectedKeys ?? [])).toEqual(entries.map((entry) => entry.key));
  });

  it("clears the current selection from the batch action bar", async () => {
    const user = userEvent.setup();
    const props = createProps({
      selectedKeys: new Set(["downloads/react-19.tgz"]),
    });

    render(<CacheBrowserPanel {...props} />);

    await user.click(
      screen.getByRole("button", { name: "cache.detail.deselectAll" }),
    );

    const selectedKeys = props.onSelectedKeysChange.mock.calls.at(-1)?.[0] as
      | Set<string>
      | undefined;

    expect(selectedKeys).toBeDefined();
    expect(Array.from(selectedKeys ?? [])).toEqual([]);
  });

  it("retries loading when the inline retry action is pressed", async () => {
    const user = userEvent.setup();
    const props = createProps({ error: "Load failed" });

    render(<CacheBrowserPanel {...props} />);

    await user.click(screen.getByRole("button", { name: "common.retry" }));

    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("moves to the next page from the pagination controls", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheBrowserPanel {...props} />);

    await user.click(screen.getByRole("button", { name: "common.next" }));

    expect(props.onPageChange).toHaveBeenCalledWith(1);
  });
});

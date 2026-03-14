import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomCacheDialog } from "./custom-cache-dialog";

let mockIsTauri = false;

jest.mock("@/lib/tauri", () => ({
  get isTauri() {
    return () => mockIsTauri;
  },
}));

function createProps(overrides: Partial<React.ComponentProps<typeof CustomCacheDialog>> = {}) {
  return {
    entries: [],
    onEntriesChange: jest.fn(),
    t: (key: string) => key,
    ...overrides,
  };
}

describe("CustomCacheDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
  });

  it("shows the empty-state message when no custom caches are configured", () => {
    render(<CustomCacheDialog {...createProps()} />);

    expect(screen.getByText("settings.customCacheEmpty")).toBeInTheDocument();
  });

  it("adds a new custom cache entry from the dialog", async () => {
    const user = userEvent.setup();
    const props = createProps();
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(123456789);

    render(<CustomCacheDialog {...props} />);

    await user.click(screen.getByRole("button", { name: "settings.customCacheAdd" }));

    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cache.customCacheNamePlaceholder"),
      "NPM Cache",
    );
    await user.type(
      within(dialog).getByPlaceholderText("cache.customCachePathPlaceholder"),
      "C:\\cache\\npm",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "settings.customCacheAdd" }),
    );

    expect(props.onEntriesChange).toHaveBeenCalledWith([
      {
        id: "custom_npm_cache_123456789",
        displayName: "NPM Cache",
        path: "C:\\cache\\npm",
        category: "package_manager",
      },
    ]);

    dateNowSpy.mockRestore();
  });

  it("removes an existing custom cache entry", async () => {
    const user = userEvent.setup();
    const props = createProps({
      entries: [
        {
          id: "cache-1",
          displayName: "NPM Cache",
          path: "C:\\cache\\npm",
          category: "package_manager",
        },
        {
          id: "cache-2",
          displayName: "Pip Cache",
          path: "C:\\cache\\pip",
          category: "devtools",
        },
      ],
    });

    render(<CustomCacheDialog {...props} />);

    const itemName = screen.getByText("NPM Cache");
    const itemContainer = itemName.closest("div")?.parentElement;
    const removeButton = itemContainer?.querySelector("button");

    expect(removeButton).toBeTruthy();

    await user.click(removeButton as HTMLButtonElement);

    expect(props.onEntriesChange).toHaveBeenCalledWith([
      {
        id: "cache-2",
        displayName: "Pip Cache",
        path: "C:\\cache\\pip",
        category: "devtools",
      },
    ]);
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CachePreviewDialog } from "./cache-preview-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/cache/scopes", () => ({
  cleanTypeLabelKey: (cleanType: string) => `label.${cleanType}`,
}));

const previewData = {
  files: [
    {
      path: "C:\\Users\\test\\Downloads\\react-19.tgz",
      size_human: "1.2 MB",
      entry_type: "download",
    },
  ],
  skipped: [
    {
      path: "C:\\Users\\test\\Downloads\\keep.txt",
      reason: "protected",
    },
  ],
  skipped_count: 1,
  total_count: 1,
  total_size_human: "1.2 MB",
};

function createProps(
  overrides: Partial<React.ComponentProps<typeof CachePreviewDialog>> = {},
) {
  return {
    previewOpen: true,
    setPreviewOpen: jest.fn(),
    previewData,
    previewType: "default_downloads" as const,
    previewLoading: false,
    defaultDownloadsRoot: "C:\\Users\\test\\Downloads",
    useTrash: true,
    setUseTrash: jest.fn(),
    operationLoading: null,
    handleEnhancedClean: jest.fn(),
    ...overrides,
  };
}

describe("CachePreviewDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the default downloads safety details and skipped files", () => {
    render(<CachePreviewDialog {...createProps()} />);

    expect(screen.getByText(/cache\.defaultDownloadsRoot/)).toBeInTheDocument();
    expect(screen.getByText("C:\\Users\\test\\Downloads")).toBeInTheDocument();
    expect(screen.getByText(/cache\.skippedFiles/)).toBeInTheDocument();
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("closes from the cancel action and toggles trash usage", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CachePreviewDialog {...props} />);

    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(props.setUseTrash).toHaveBeenCalledWith(false);
    expect(props.setPreviewOpen).toHaveBeenCalledWith(false);
  });

  it("runs the enhanced clean action when confirmation is available", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CachePreviewDialog {...props} />);

    await user.click(screen.getByRole("button", { name: "cache.confirmClean" }));

    expect(props.handleEnhancedClean).toHaveBeenCalledTimes(1);
  });

  it("shows the empty-file state and disables cleaning when nothing matches", () => {
    render(
      <CachePreviewDialog
        {...createProps({
          previewType: "downloads",
          previewData: {
            files: [],
            total_count: 0,
            total_size_human: "0 B",
          },
        })}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("cache.noFilesToClean")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "cache.confirmClean" }),
    ).toBeDisabled();
  });
});

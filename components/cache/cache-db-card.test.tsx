import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheDbCard } from "./cache-db-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

function createProps(overrides: Partial<React.ComponentProps<typeof CacheDbCard>> = {}) {
  return {
    dbInfo: null,
    dbInfoLoading: false,
    optimizeResult: null,
    optimizeLoading: false,
    isLoading: false,
    fetchDbInfo: jest.fn(),
    handleOptimize: jest.fn(),
    ...overrides,
  };
}

describe("CacheDbCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the placeholder when there is no database data yet", () => {
    render(<CacheDbCard {...createProps()} />);

    expect(screen.getByText("cache.noDataYet")).toBeInTheDocument();
  });

  it("calls the view info and optimize actions", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheDbCard {...props} />);

    await user.click(screen.getByRole("button", { name: "cache.viewDbInfo" }));
    await user.click(screen.getByRole("button", { name: "cache.optimizeNow" }));

    expect(props.fetchDbInfo).toHaveBeenCalledTimes(1);
    expect(props.handleOptimize).toHaveBeenCalledTimes(1);
  });

  it("renders optimize results and database metrics when present", () => {
    render(
      <CacheDbCard
        {...createProps({
          optimizeResult: {
            sizeBeforeHuman: "2.0 GB",
            sizeAfterHuman: "1.5 GB",
            sizeSavedHuman: "512 MB",
          },
          dbInfo: {
            dbSizeHuman: "1.5 GB",
            walSizeHuman: "120 MB",
            pageCount: 1024,
            freelistCount: 12,
          },
        })}
      />,
    );

    expect(screen.getByText("2.0 GB")).toBeInTheDocument();
    expect(screen.getAllByText("1.5 GB")).toHaveLength(2);
    expect(screen.getByText("-512 MB")).toBeInTheDocument();
    expect(screen.getByText("120 MB")).toBeInTheDocument();
    expect(screen.getByText("1,024")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

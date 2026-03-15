import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheHealthCard } from "./cache-health-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

function createProps(
  overrides: Partial<React.ComponentProps<typeof CacheHealthCard>> = {},
) {
  return {
    cacheVerification: null,
    isLoading: false,
    isVerifying: false,
    isRepairing: false,
    totalIssues: 0,
    handleVerify: jest.fn(),
    handleRepair: jest.fn(),
    ...overrides,
  };
}

describe("CacheHealthCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the idle state before verification has run", () => {
    render(<CacheHealthCard {...createProps()} />);

    expect(screen.getByText("cache.noIssues")).toBeInTheDocument();
    expect(screen.getByText("cache.healthIdleDesc")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "cache.repair" }),
    ).not.toBeInTheDocument();
  });

  it("runs cache verification from the action button", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheHealthCard {...props} />);

    await user.click(screen.getByRole("button", { name: "cache.verify" }));

    expect(props.handleVerify).toHaveBeenCalledTimes(1);
  });

  it("shows unhealthy details and allows repairing issues", async () => {
    const user = userEvent.setup();
    const props = createProps({
      cacheVerification: {
        is_healthy: false,
        valid_entries: 18,
        missing_files: 2,
        corrupted_files: 1,
        size_mismatches: 0,
        details: [
          {
            entry_key: "downloads/react-19.tgz",
            description: "Missing backing file",
          },
        ],
      },
      totalIssues: 3,
    });

    render(<CacheHealthCard {...props} />);

    expect(screen.getByText("cache.unhealthy")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /cache\.issueDetails/ }),
    );

    expect(screen.getByText("downloads/react-19.tgz")).toBeInTheDocument();
    expect(screen.getByText("Missing backing file")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "cache.repair" }));

    expect(props.handleRepair).toHaveBeenCalledTimes(1);
  });
});

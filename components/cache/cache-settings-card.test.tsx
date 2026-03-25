import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheSettingsCard } from "./cache-settings-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const baseSettings = {
  max_size: 512 * 1024 * 1024,
  max_age_days: 14,
  metadata_cache_ttl: 600,
  auto_clean: false,
  auto_clean_threshold: 80,
  monitor_interval: 300,
  monitor_external: false,
  external_cache_excluded_providers: [],
  custom_cache_entries: [],
};

function createProps(
  overrides: Partial<React.ComponentProps<typeof CacheSettingsCard>> = {},
) {
  return {
    localSettings: baseSettings,
    settingsDirty: false,
    loading: false,
    isSavingSettings: false,
    handleSettingsChange: jest.fn(),
    handleSaveSettings: jest.fn(),
    ...overrides,
  };
}

describe("CacheSettingsCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the loading branch before settings are available", () => {
    render(
      <CacheSettingsCard
        {...createProps({
          localSettings: null,
          loading: true,
        })}
      />,
    );

    expect(screen.getByText("cache.settings")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "common.save" }),
    ).not.toBeInTheDocument();
  });

  it("propagates numeric field edits and the auto-clean toggle", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<CacheSettingsCard {...props} />);

    fireEvent.change(screen.getByLabelText("cache.maxSize"), {
      target: { value: "256" },
    });
    fireEvent.change(screen.getByLabelText("cache.maxAge"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("cache.metadataCacheTtl"), {
      target: { value: "1200" },
    });
    await user.click(screen.getByRole("switch"));

    expect(props.handleSettingsChange).toHaveBeenCalledWith(
      "max_size",
      256 * 1024 * 1024,
    );
    expect(props.handleSettingsChange).toHaveBeenCalledWith("max_age_days", 30);
    expect(props.handleSettingsChange).toHaveBeenCalledWith(
      "metadata_cache_ttl",
      1200,
    );
    expect(props.handleSettingsChange).toHaveBeenCalledWith("auto_clean", true);
  });

  it("shows nested auto-clean controls and saves when dirty", async () => {
    const user = userEvent.setup();
    const props = createProps({
      localSettings: {
        ...baseSettings,
        auto_clean: true,
        monitor_external: true,
      },
      settingsDirty: true,
    });

    render(<CacheSettingsCard {...props} />);

    expect(screen.getByLabelText("cache.autoCleanThreshold")).toBeInTheDocument();
    expect(screen.getByLabelText("cache.monitorInterval")).toBeInTheDocument();
    expect(screen.getByText("cache.monitorExternal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.save" }));

    expect(props.handleSaveSettings).toHaveBeenCalledTimes(1);
  });

  it("renders external cache support controls and propagates exclusion edits", () => {
    const props = createProps({
      localSettings: {
        ...baseSettings,
        external_cache_excluded_providers: ["gradle"],
      },
    });

    render(<CacheSettingsCard {...props} />);

    expect(
      screen.getByLabelText("settings.externalCacheExcludedProviders"),
    ).toBeInTheDocument();
    expect(screen.getByText("settings.customCacheEntries")).toBeInTheDocument();
    expect(screen.getByText("settings.customCacheEmpty")).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText("settings.externalCacheExcludedProviders"),
      {
        target: { value: "gradle, maven , sbt" },
      },
    );

    expect(props.handleSettingsChange).toHaveBeenCalledWith(
      "external_cache_excluded_providers",
      ["gradle", "maven", "sbt"],
    );
  });
});

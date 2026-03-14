import { render, screen } from "@testing-library/react";
import { CacheSidebar } from "./cache-sidebar";

const mockCacheSettingsCard = jest.fn();
const mockCachePathCard = jest.fn();

jest.mock("./cache-settings-card", () => ({
  CacheSettingsCard: (
    props: Record<string, unknown>,
  ) => {
    mockCacheSettingsCard(props);
    return <div data-testid="cache-settings-card" />;
  },
}));

jest.mock("./cache-path-card", () => ({
  CachePathCard: (
    props: Record<string, unknown>,
  ) => {
    mockCachePathCard(props);
    return <div data-testid="cache-path-card" />;
  },
}));

describe("CacheSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the settings and path cards with forwarded props", () => {
    const props = {
      localSettings: {
        max_size: 512 * 1024 * 1024,
        max_age_days: 14,
        metadata_cache_ttl: 600,
        auto_clean: false,
      },
      settingsDirty: true,
      settingsLoading: false,
      isSavingSettings: false,
      handleSettingsChange: jest.fn(),
      handleSaveSettings: jest.fn(),
      pathRefreshTrigger: 2,
      onPathChanged: jest.fn(),
    };

    render(<CacheSidebar {...props} />);

    expect(screen.getByTestId("cache-settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("cache-path-card")).toBeInTheDocument();

    expect(mockCacheSettingsCard).toHaveBeenCalledWith(
      expect.objectContaining({
        localSettings: props.localSettings,
        settingsDirty: true,
        loading: false,
        isSavingSettings: false,
        handleSettingsChange: props.handleSettingsChange,
        handleSaveSettings: props.handleSaveSettings,
      }),
    );
    expect(mockCachePathCard).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTrigger: 2,
        onPathChanged: props.onPathChanged,
      }),
    );
  });
});

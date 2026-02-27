import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadSettingsCard } from "./download-settings-card";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "downloads.settings.speedLimit": "Speed Limit",
    "downloads.settings.speedLimitDesc": "Limit download speed",
    "downloads.settings.unlimited": "Unlimited",
    "downloads.settings.maxConcurrent": "Max Concurrent",
    "downloads.settings.maxConcurrentDesc": "Maximum concurrent downloads",
    "common.save": "Save",
  };
  return translations[key] || key;
};

describe("DownloadSettingsCard", () => {
  const defaultProps = {
    speedLimitInput: "0",
    onSpeedLimitChange: jest.fn(),
    speedUnit: "B/s" as const,
    onSpeedUnitChange: jest.fn(),
    maxConcurrentInput: "4",
    onMaxConcurrentChange: jest.fn(),
    onApply: jest.fn(),
    disabled: false,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders card title and description", () => {
    render(<DownloadSettingsCard {...defaultProps} />);

    // "Speed Limit" appears as both title and label, so use getAllByText
    expect(screen.getAllByText("Speed Limit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Limit download speed")).toBeInTheDocument();
  });

  it("renders speed limit input with current value", () => {
    render(<DownloadSettingsCard {...defaultProps} speedLimitInput="100" />);

    const input = screen.getByLabelText("Speed Limit");
    expect(input).toHaveValue(100);
  });

  it("renders max concurrent input with current value", () => {
    render(<DownloadSettingsCard {...defaultProps} maxConcurrentInput="8" />);

    const input = screen.getByLabelText("Max Concurrent");
    expect(input).toHaveValue(8);
  });

  it("shows 'Unlimited' text when speed limit is 0", () => {
    render(<DownloadSettingsCard {...defaultProps} speedLimitInput="0" />);

    expect(screen.getByText("Unlimited")).toBeInTheDocument();
  });

  it("shows speed value with unit when speed limit is not 0", () => {
    render(
      <DownloadSettingsCard
        {...defaultProps}
        speedLimitInput="512"
        speedUnit="KB/s"
      />,
    );

    expect(screen.getByText("512 KB/s")).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<DownloadSettingsCard {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("disables save button when disabled prop is true", () => {
    render(<DownloadSettingsCard {...defaultProps} disabled={true} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("enables save button when disabled prop is false", () => {
    render(<DownloadSettingsCard {...defaultProps} disabled={false} />);

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("calls onApply when clicking save button", async () => {
    const onApply = jest.fn();
    render(<DownloadSettingsCard {...defaultProps} onApply={onApply} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("calls onSpeedLimitChange when typing in speed limit input", async () => {
    const onSpeedLimitChange = jest.fn();
    render(
      <DownloadSettingsCard
        {...defaultProps}
        onSpeedLimitChange={onSpeedLimitChange}
      />,
    );

    const input = screen.getByLabelText("Speed Limit");
    await userEvent.clear(input);
    await userEvent.type(input, "512");

    expect(onSpeedLimitChange).toHaveBeenCalled();
  });

  it("calls onMaxConcurrentChange when typing in max concurrent input", async () => {
    const onMaxConcurrentChange = jest.fn();
    render(
      <DownloadSettingsCard
        {...defaultProps}
        onMaxConcurrentChange={onMaxConcurrentChange}
      />,
    );

    const input = screen.getByLabelText("Max Concurrent");
    await userEvent.clear(input);
    await userEvent.type(input, "8");

    expect(onMaxConcurrentChange).toHaveBeenCalled();
  });

  it("renders max concurrent description text", () => {
    render(<DownloadSettingsCard {...defaultProps} />);

    expect(screen.getByText("Maximum concurrent downloads")).toBeInTheDocument();
  });
});

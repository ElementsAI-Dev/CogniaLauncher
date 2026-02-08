import { render, screen, waitFor } from "@testing-library/react";
import { EnvironmentDetectionStep } from "./environment-detection-step";

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.envDetectionTitle": "Environment Detection",
    "onboarding.envDetectionDesc": "Detecting installed tools",
    "onboarding.envDetecting": "Detecting...",
    "onboarding.envDetectedCount": "Detected environments",
    "onboarding.envAvailable": "Available",
    "onboarding.envNotFound": "Not Found",
    "onboarding.envRescan": "Rescan",
    "onboarding.envWebModeNote": "Running in web mode",
  };
  return translations[key] || key;
};

describe("EnvironmentDetectionStep", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders title", () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    expect(screen.getByText("Environment Detection")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    expect(screen.getByText("Detecting installed tools")).toBeInTheDocument();
  });

  it("shows detecting state initially", () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    expect(screen.getByText("Detecting...")).toBeInTheDocument();
  });

  it("shows results after detection completes", async () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    jest.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText("Node.js")).toBeInTheDocument();
    });
  });

  it("shows rescan button after detection", async () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    jest.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText("Rescan")).toBeInTheDocument();
    });
  });

  it("shows web mode note in non-Tauri environment", async () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    jest.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText("Running in web mode")).toBeInTheDocument();
    });
  });
});

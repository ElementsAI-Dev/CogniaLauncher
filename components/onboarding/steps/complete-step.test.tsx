import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompleteStep } from "./complete-step";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.completeTitle": "All Done!",
    "onboarding.completeDesc": "You're all set",
    "onboarding.completeDetailedDesc": "Detailed onboarding is complete",
    "onboarding.completeTakeTour": "Take a Tour",
    "onboarding.completeDetailedTakeTour": "Continue with the Guided Tour",
    "onboarding.completeDetailedTourDesc": "The tour is the best next step",
    "onboarding.completeHint": "Click Finish to get started",
    "onboarding.completeDetailedHint": "Finish now or continue into the tour",
  };
  return translations[key] || key;
};

describe("CompleteStep", () => {
  const defaultProps = {
    t: mockT,
    onStartTour: jest.fn(),
    tourCompleted: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title", () => {
    render(<CompleteStep {...defaultProps} />);
    expect(screen.getByText("All Done!")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<CompleteStep {...defaultProps} />);
    expect(screen.getByText("You're all set")).toBeInTheDocument();
  });

  it("renders take tour button when tour not completed", () => {
    render(<CompleteStep {...defaultProps} />);
    expect(screen.getByText("Take a Tour")).toBeInTheDocument();
  });

  it("hides take tour button when tour completed", () => {
    render(<CompleteStep {...defaultProps} tourCompleted={true} />);
    expect(screen.queryByText("Take a Tour")).not.toBeInTheDocument();
  });

  it("calls onStartTour when tour button is clicked", async () => {
    render(<CompleteStep {...defaultProps} />);
    await userEvent.click(screen.getByText("Take a Tour"));
    expect(defaultProps.onStartTour).toHaveBeenCalledTimes(1);
  });

  it("renders hint text", () => {
    render(<CompleteStep {...defaultProps} />);
    expect(screen.getByText("Click Finish to get started")).toBeInTheDocument();
  });

  it("renders confetti particles", () => {
    const { container } = render(<CompleteStep {...defaultProps} />);
    const particles = container.querySelectorAll(".onboarding-confetti-particle");
    expect(particles.length).toBe(8);
  });

  it("renders icon with zoom animation", () => {
    const { container } = render(<CompleteStep {...defaultProps} />);
    const animatedIcon = container.querySelector(".zoom-in-50");
    expect(animatedIcon).toBeInTheDocument();
  });

  it("promotes the guided tour more strongly in detailed mode", () => {
    render(<CompleteStep {...defaultProps} mode="detailed" />);
    expect(screen.getByText("Detailed onboarding is complete")).toBeInTheDocument();
    expect(screen.getByText("The tour is the best next step")).toBeInTheDocument();
    expect(screen.getByText("Continue with the Guided Tour")).toBeInTheDocument();
    expect(screen.getByText("Finish now or continue into the tour")).toBeInTheDocument();
  });
});

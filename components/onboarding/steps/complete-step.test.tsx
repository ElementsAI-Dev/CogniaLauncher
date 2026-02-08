import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompleteStep } from "./complete-step";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.completeTitle": "All Done!",
    "onboarding.completeDesc": "You're all set",
    "onboarding.completeTakeTour": "Take a Tour",
    "onboarding.completeHint": "Click Finish to get started",
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
});

import { render, screen } from "@testing-library/react";
import { SpeedChart } from "./speed-chart";

const mockSpeedHistory: number[] = [];

jest.mock("@/lib/stores/download", () => ({
  useDownloadStore: (selector: (s: { speedHistory: number[] }) => unknown) =>
    selector({ speedHistory: mockSpeedHistory }),
}));

// recharts uses ResizeObserver internally
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const mockT = (key: string) => key;

function setSpeedHistory(data: number[]) {
  mockSpeedHistory.length = 0;
  mockSpeedHistory.push(...data);
}

describe("SpeedChart", () => {
  beforeEach(() => {
    setSpeedHistory([]);
  });

  it("returns null when speedHistory has fewer than 2 data points", () => {
    setSpeedHistory([100]);
    const { container } = render(<SpeedChart t={mockT} />);

    expect(container.firstChild).toBeNull();
  });

  it("returns null when speedHistory is empty", () => {
    setSpeedHistory([]);
    const { container } = render(<SpeedChart t={mockT} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders chart container when data has 2+ points", () => {
    setSpeedHistory([100, 200]);
    render(<SpeedChart t={mockT} />);

    expect(
      screen.getByText("downloads.settings.speedChart"),
    ).toBeInTheDocument();
  });

  it("applies custom className", () => {
    setSpeedHistory([100, 200, 300]);
    const { container } = render(
      <SpeedChart t={mockT} className="my-custom-class" />,
    );

    expect(container.firstChild).toHaveClass("my-custom-class");
  });
});

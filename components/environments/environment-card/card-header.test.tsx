import { render, screen } from "@testing-library/react";
import { CardHeader } from "./card-header";

describe("CardHeader", () => {
  const mockT = (key: string, params?: Record<string, string>) => {
    const translations: Record<string, string> = {
      "environments.detectedVersion": `Detected: ${params?.version || ""} (${params?.source || ""})`,
    };
    return translations[key] || key;
  };

  const defaultProps = {
    envType: "Node",
    t: mockT,
  };

  it("renders environment type as title", () => {
    render(<CardHeader {...defaultProps} />);
    expect(screen.getByText("Node")).toBeInTheDocument();
  });

  it("capitalizes environment type", () => {
    render(<CardHeader {...defaultProps} envType="python" />);
    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("does not render detected version when not provided", () => {
    render(<CardHeader {...defaultProps} />);
    expect(screen.queryByText(/Detected/)).not.toBeInTheDocument();
  });

  it("renders detected version badge when provided", () => {
    const detectedVersion = {
      env_type: "Node",
      version: "18.0.0",
      source: "nvmrc",
      source_path: "/project/.nvmrc",
    };
    render(<CardHeader {...defaultProps} detectedVersion={detectedVersion} />);
    expect(screen.getByText("Detected: 18.0.0 (nvmrc)")).toBeInTheDocument();
  });

  it("renders detected version with correct styling", () => {
    const detectedVersion = {
      env_type: "Node",
      version: "20.0.0",
      source: "package_json",
      source_path: "/project/package.json",
    };
    const { container } = render(
      <CardHeader {...defaultProps} detectedVersion={detectedVersion} />,
    );
    const badge = container.querySelector(".bg-green-50");
    expect(badge).toBeInTheDocument();
  });

  it("renders title with correct styling", () => {
    render(<CardHeader {...defaultProps} />);
    const title = screen.getByText("Node");
    expect(title.tagName.toLowerCase()).toBe("h3");
    expect(title).toHaveClass("text-lg", "font-semibold");
  });
});

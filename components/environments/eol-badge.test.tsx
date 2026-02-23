import { render, screen, waitFor } from "@testing-library/react";
import { EolBadge } from "./eol-badge";

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => true),
  envGetVersionEol: jest.fn(),
}));

const mockTauri = jest.requireMock("@/lib/tauri");

const t = (key: string) => {
  const translations: Record<string, string> = {
    "environments.eol.endOfLife": "End of Life",
    "environments.eol.approaching": "EOL Approaching",
    "environments.eol.supported": "Supported",
    "environments.eol.lts": "LTS",
    "environments.eol.eolWarning": "This version has reached End of Life",
    "environments.eol.approachingWarning": "This version will reach End of Life within 6 months",
    "environments.eol.eolDate": "EOL Date",
    "environments.eol.activeSupport": "Active Support Until",
    "environments.eol.latestInCycle": "Latest in Cycle",
  };
  return translations[key] || key;
};

describe("EolBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTauri.isTauri.mockReturnValue(true);
  });

  it("renders nothing when version is null", () => {
    const { container } = render(
      <EolBadge envType="node" version={null} t={t} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when not in Tauri", () => {
    mockTauri.isTauri.mockReturnValue(false);
    const { container } = render(
      <EolBadge envType="node" version="22.0.0" t={t} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders EOL badge for end-of-life version", async () => {
    mockTauri.envGetVersionEol.mockResolvedValue({
      cycle: "16",
      releaseDate: "2021-04-20",
      eol: "2023-09-11",
      latest: "16.20.2",
      lts: "2021-10-26",
      support: "2022-10-18",
      isEol: true,
      eolApproaching: false,
    });

    render(<EolBadge envType="node" version="16.20.0" t={t} />);

    await waitFor(() => {
      expect(screen.getByText("End of Life")).toBeInTheDocument();
    });
  });

  it("renders approaching badge for versions near EOL", async () => {
    mockTauri.envGetVersionEol.mockResolvedValue({
      cycle: "20",
      releaseDate: "2023-04-18",
      eol: "2026-04-30",
      latest: "20.20.0",
      lts: "2023-10-24",
      support: "2024-10-22",
      isEol: false,
      eolApproaching: true,
    });

    render(<EolBadge envType="node" version="20.10.0" t={t} />);

    await waitFor(() => {
      expect(screen.getByText("EOL Approaching")).toBeInTheDocument();
    });
  });

  it("renders LTS badge for LTS version", async () => {
    mockTauri.envGetVersionEol.mockResolvedValue({
      cycle: "22",
      releaseDate: "2024-04-24",
      eol: "2027-04-30",
      latest: "22.22.0",
      lts: "2024-10-29",
      support: "2025-10-21",
      isEol: false,
      eolApproaching: false,
    });

    render(<EolBadge envType="node" version="22.11.0" t={t} />);

    await waitFor(() => {
      expect(screen.getByText("LTS")).toBeInTheDocument();
    });
  });

  it("renders Supported badge for non-LTS supported version", async () => {
    mockTauri.envGetVersionEol.mockResolvedValue({
      cycle: "23",
      releaseDate: "2024-10-16",
      eol: "2025-06-01",
      latest: "23.11.1",
      lts: null,
      support: "2025-04-01",
      isEol: false,
      eolApproaching: false,
    });

    render(<EolBadge envType="node" version="23.5.0" t={t} />);

    await waitFor(() => {
      expect(screen.getByText("Supported")).toBeInTheDocument();
    });
  });

  it("renders nothing when API returns null", async () => {
    mockTauri.envGetVersionEol.mockResolvedValue(null);

    const { container } = render(
      <EolBadge envType="node" version="99.0.0" t={t} />,
    );

    await waitFor(() => {
      expect(mockTauri.envGetVersionEol).toHaveBeenCalled();
    });
    expect(container.querySelector("[class*='badge']")).toBeNull();
  });

  it("renders nothing on API error", async () => {
    mockTauri.envGetVersionEol.mockRejectedValue(new Error("API error"));

    const { container } = render(
      <EolBadge envType="node" version="22.0.0" t={t} />,
    );

    await waitFor(() => {
      expect(mockTauri.envGetVersionEol).toHaveBeenCalled();
    });
    expect(container.querySelector("[class*='badge']")).toBeNull();
  });

  it("uses compact mode when compact prop is true", async () => {
    mockTauri.envGetVersionEol.mockResolvedValue({
      cycle: "16",
      releaseDate: "2021-04-20",
      eol: "2023-09-11",
      latest: "16.20.2",
      lts: null,
      support: null,
      isEol: true,
      eolApproaching: false,
    });

    render(<EolBadge envType="node" version="16.20.0" compact t={t} />);

    await waitFor(() => {
      expect(screen.getByText("EOL")).toBeInTheDocument();
    });
  });
});

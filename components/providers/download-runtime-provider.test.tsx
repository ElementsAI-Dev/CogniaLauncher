import { render, screen } from "@testing-library/react";
import { DownloadRuntimeProvider } from "./download-runtime-provider";

const mockUseDownloads = jest.fn();

jest.mock("@/hooks/downloads/use-downloads", () => ({
  useDownloads: (...args: unknown[]) => mockUseDownloads(...args),
}));

describe("DownloadRuntimeProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mounts download runtime in runtime mode and renders children", () => {
    render(
      <DownloadRuntimeProvider>
        <div>runtime child</div>
      </DownloadRuntimeProvider>,
    );

    expect(mockUseDownloads).toHaveBeenCalledWith({ enableRuntime: true });
    expect(screen.getByText("runtime child")).toBeInTheDocument();
  });
});

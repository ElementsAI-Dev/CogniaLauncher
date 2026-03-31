import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroEnvvars } from "./wsl-distro-envvars";

describe("WslDistroEnvvars", () => {
  const mockReadDistroEnv = jest.fn();
  const mockExportWindowsEnv = jest.fn();
  const mockGetWslenv = jest.fn();
  const mockSetWslenv = jest.fn();
  const t = (key: string) => {
    const translations: Record<string, string> = {
      "wsl.detail.envvarsTitle": "Environment Variables",
      "wsl.detail.envvarsDesc": "Read distro env and manage WSLENV",
      "wsl.detail.importWindowsEnv": "Import Windows Env",
      "wsl.detail.noEnvVars": "No env vars",
      "wsl.detail.wslenvDesc": "Shared Windows/Linux variable bridge",
      "wsl.detail.noWslenvEntries": "No WSLENV entries",
      "wsl.detail.wslenvKey": "WSLENV Key",
      "wsl.detail.wslenvFlags": "WSLENV Flags",
      "wsl.detail.removeWslenv": "Remove {key}",
      "envvar.table.copy": "Copy",
      "envvar.table.reveal": "Reveal",
      "common.refresh": "Refresh",
      "common.add": "Add",
      "common.error": "Error",
    };
    return translations[key] || key;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadDistroEnv.mockResolvedValue({
      distro: "Ubuntu",
      variables: [
        { key: "PATH", value: "/usr/bin" },
        { key: "API_TOKEN", value: "secret-token" },
      ],
    });
    mockExportWindowsEnv.mockResolvedValue({
      distro: "Ubuntu",
      targetPath: "~/.cognia_env",
      variableCount: 2,
    });
    mockGetWslenv.mockResolvedValue([{ key: "JAVA_HOME", flags: ["p", "u"] }]);
    mockSetWslenv.mockResolvedValue(undefined);
  });

  it("loads distro env vars and WSLENV entries on mount", async () => {
    render(
      <WslDistroEnvvars
        distroName="Ubuntu"
        readDistroEnv={mockReadDistroEnv}
        exportWindowsEnv={mockExportWindowsEnv}
        getWslenv={mockGetWslenv}
        setWslenv={mockSetWslenv}
        t={t}
      />,
    );

    expect(await screen.findByText("Environment Variables")).toBeInTheDocument();
    expect(await screen.findByText("PATH")).toBeInTheDocument();
    expect(await screen.findByText("JAVA_HOME")).toBeInTheDocument();
    expect(mockReadDistroEnv).toHaveBeenCalledWith("Ubuntu");
    expect(mockGetWslenv).toHaveBeenCalled();
  });

  it("exports Windows env and persists WSLENV additions/removals", async () => {
    const user = userEvent.setup();
    render(
      <WslDistroEnvvars
        distroName="Ubuntu"
        readDistroEnv={mockReadDistroEnv}
        exportWindowsEnv={mockExportWindowsEnv}
        getWslenv={mockGetWslenv}
        setWslenv={mockSetWslenv}
        t={t}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Environment Variables")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Import Windows Env" }));
    expect(mockExportWindowsEnv).toHaveBeenCalledWith("Ubuntu");

    await user.type(screen.getByLabelText("WSLENV Key"), "GOPATH");
    await user.type(screen.getByLabelText("WSLENV Flags"), "p");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(mockSetWslenv).toHaveBeenCalledWith([
      { key: "JAVA_HOME", flags: ["p", "u"] },
      { key: "GOPATH", flags: ["p"] },
    ]);

    await user.click(screen.getByRole("button", { name: "Remove JAVA_HOME" }));
    expect(mockSetWslenv).toHaveBeenLastCalledWith([{ key: "GOPATH", flags: ["p"] }]);
  });
});

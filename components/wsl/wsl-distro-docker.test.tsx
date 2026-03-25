import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslDistroDocker } from "./wsl-distro-docker";
import type { WslExecResult } from "@/types/tauri";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const t = (key: string) => {
  const dict: Record<string, string> = {
    "wsl.detail.docker.title": "Docker",
    "wsl.detail.docker.notRunning": "Distro is not running",
    "wsl.detail.docker.notInstalled": "Docker is not installed",
    "wsl.detail.docker.prune": "Prune",
    "wsl.detail.docker.pruneDesc": "Clean unused Docker data",
    "wsl.detail.docker.containers": "Containers",
    "wsl.detail.docker.images": "Images",
    "wsl.detail.docker.containerName": "Name",
    "wsl.detail.docker.containerImage": "Image",
    "wsl.detail.docker.containerStatus": "Status",
    "wsl.detail.docker.containerActions": "Actions",
    "wsl.detail.docker.noContainers": "No containers",
    "wsl.detail.dockerSearchContainers": "Search containers",
    "wsl.detail.docker.imageRepo": "Repository",
    "wsl.detail.docker.imageTag": "Tag",
    "wsl.detail.docker.imageSize": "Size",
    "wsl.detail.dockerPruneConfirmTitle": "Confirm prune",
    "wsl.detail.dockerPruneConfirmDesc": "This will remove unused Docker resources.",
    "wsl.detail.docker.actionSuccess": "Action {action} succeeded",
    "wsl.detail.docker.pruneSuccess": "Prune completed",
    "common.cancel": "Cancel",
  };
  return dict[key] ?? key;
};

function createExecMock(): jest.Mock<Promise<WslExecResult>, [string, string, string?]> {
  return jest.fn(async (_distro, command) => {
    if (command.includes("docker version")) {
      return { exitCode: 0, stdout: "25.0.3\n", stderr: "" };
    }
    if (command.includes("docker ps -a")) {
      return {
        exitCode: 0,
        stdout: [
          "id-1\tweb\tnginx:latest\tUp 2 hours\t80/tcp\trunning",
          "id-2\tdb\tpostgres:16\tExited (0)\t\texited",
        ].join("\n"),
        stderr: "",
      };
    }
    if (command.includes("docker images")) {
      return {
        exitCode: 0,
        stdout: [
          "nginx\tlatest\timg-1\t110MB",
          "postgres\t16\timg-2\t1.2GB",
        ].join("\n"),
        stderr: "",
      };
    }
    if (command.includes("docker system prune -f")) {
      return { exitCode: 0, stdout: "Total reclaimed space: 0B", stderr: "" };
    }
    if (command.includes("docker start") || command.includes("docker stop") || command.includes("docker restart")) {
      return { exitCode: 0, stdout: "ok", stderr: "" };
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  });
}

describe("WslDistroDocker", () => {
  it("shows not-running state", () => {
    const onExec = createExecMock();
    render(
      <WslDistroDocker
        distroName="Ubuntu"
        isRunning={false}
        onExec={onExec}
        t={t}
      />,
    );

    expect(screen.getByText("Distro is not running")).toBeInTheDocument();
    expect(onExec).not.toHaveBeenCalled();
  });

  it("shows not-installed state when docker version is empty", async () => {
    const onExec = jest.fn(async (_distro: string, command: string) => {
      if (command.includes("docker version")) {
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    });

    render(
      <WslDistroDocker
        distroName="Ubuntu"
        isRunning
        onExec={onExec}
        t={t}
      />,
    );

    expect(await screen.findByText("Docker is not installed")).toBeInTheDocument();
  });

  it("renders containers and images when docker is available", async () => {
    const onExec = createExecMock();
    render(
      <WslDistroDocker
        distroName="Ubuntu"
        isRunning
        onExec={onExec}
        t={t}
      />,
    );

    expect(await screen.findByText("web")).toBeInTheDocument();
    expect(screen.getByText("db")).toBeInTheDocument();
    expect(screen.getByText("25.0.3")).toBeInTheDocument();
    expect(screen.getByText("postgres")).toBeInTheDocument();
  });

  it("filters containers by search keyword", async () => {
    const user = userEvent.setup();
    const onExec = createExecMock();
    render(
      <WslDistroDocker
        distroName="Ubuntu"
        isRunning
        onExec={onExec}
        t={t}
      />,
    );

    expect(await screen.findByText("web")).toBeInTheDocument();
    const search = screen.getByPlaceholderText("Search containers");
    await user.type(search, "web");

    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.queryByText("db")).not.toBeInTheDocument();
  });

  it("runs container action and refreshes", async () => {
    const user = userEvent.setup();
    const onExec = createExecMock();
    render(
      <WslDistroDocker
        distroName="Ubuntu"
        isRunning
        onExec={onExec}
        t={t}
      />,
    );

    const dbRow = (await screen.findByText("db")).closest("tr");
    expect(dbRow).toBeTruthy();
    const rowButtons = within(dbRow as HTMLTableRowElement).getAllByRole("button");
    await user.click(rowButtons[0]); // start button for exited container

    await waitFor(() => {
      expect(onExec).toHaveBeenCalledWith(
        "Ubuntu",
        expect.stringContaining("docker start id-2"),
      );
    });
  });

  it("runs prune action from confirm dialog", async () => {
    const user = userEvent.setup();
    const onExec = createExecMock();
    render(
      <WslDistroDocker
        distroName="Ubuntu"
        isRunning
        onExec={onExec}
        t={t}
      />,
    );

    expect(await screen.findByText("web")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prune" }));
    const pruneButtons = screen.getAllByRole("button", { name: "Prune" });
    await user.click(pruneButtons[pruneButtons.length - 1]);

    await waitFor(() => {
      expect(onExec).toHaveBeenCalledWith("Ubuntu", "docker system prune -f 2>&1");
    });
  });
});


import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvironmentWorkflowBanner } from "./environment-workflow-banner";

const mockClearWorkflowAction = jest.fn();
const mockClearWorkflowContext = jest.fn();

const mockStoreState = {
  workflowContext: {
    envType: "node",
    origin: "overview",
    returnHref: "/environments",
    projectPath: "/workspace/app",
    providerId: "fnm",
    updatedAt: 1,
  },
  workflowAction: {
    envType: "node",
    action: "applyProfile",
    status: "success",
    providerId: "fnm",
    projectPath: "/workspace/app",
    updatedAt: 2,
  },
};

jest.mock("@/lib/stores/environment", () => ({
  getLogicalEnvType: (value: string) => value,
  useEnvironmentStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      workflowContext: mockStoreState.workflowContext,
      workflowAction: mockStoreState.workflowAction,
      clearWorkflowAction: mockClearWorkflowAction,
      clearWorkflowContext: mockClearWorkflowContext,
    }),
}));

describe("EnvironmentWorkflowBanner", () => {
  const t = (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      "common.none": "none",
      "environments.languages.node": "Node.js",
      "environments.workflow.contextTitle": `Workflow context for ${params?.envType ?? ""}`,
      "environments.workflow.openedFrom": `Opened from ${params?.origin ?? ""}.`,
      "environments.workflow.projectPath": `Project path: ${params?.path ?? ""}`,
      "environments.workflow.projectPathCurrent": "Project path: current directory",
      "environments.workflow.provider": `Provider: ${params?.provider ?? ""}`,
      "environments.workflow.currentDirectory": "current directory",
      "environments.workflow.errorDetail": `Error: ${params?.message ?? ""}`,
      "environments.workflow.returnDashboard": "Back to Dashboard",
      "environments.workflow.returnEnvironments": "Back to Environments",
      "environments.workflow.refresh": "Refresh",
      "environments.workflow.dismiss": "Dismiss",
      "environments.workflow.clearContext": "Clear context",
      "environments.workflow.origin.detail": "Environment details",
      "environments.workflow.origin.direct": "Direct access",
      "environments.workflow.origin.overview": "Environment overview",
      "environments.workflow.hint.error": "The last action failed.",
      "environments.workflow.hint.running": "The action is still running.",
      "environments.workflow.hint.success": "Last action completed successfully.",
      "environments.workflow.hint.blocked": "Action is blocked. Check requirements and try again.",
      "environments.workflow.action.applyProfile.success": "Profile applied.",
      "environments.workflow.action.refresh.error": "Refresh failed.",
      "environments.workflow.action.install.running": "Install in progress.",
      "environments.workflow.action.setupPath.blocked": "PATH setup is blocked.",
    };

    return translations[key] || key;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.workflowContext = {
      envType: "node",
      origin: "overview",
      returnHref: "/environments",
      projectPath: "/workspace/app",
      providerId: "fnm",
      updatedAt: 1,
    };
    mockStoreState.workflowAction = {
      envType: "node",
      action: "applyProfile",
      status: "success",
      providerId: "fnm",
      projectPath: "/workspace/app",
      updatedAt: 2,
    };
  });

  it("renders profile-apply workflow messages", () => {
    render(<EnvironmentWorkflowBanner envType="node" t={t} />);

    expect(screen.getByText("Profile applied.")).toBeInTheDocument();
    expect(screen.getByText("Last action completed successfully.")).toBeInTheDocument();
    expect(screen.getByText("Provider: fnm")).toBeInTheDocument();
  });

  it("renders blocked setup-path workflow details", () => {
    mockStoreState.workflowAction = {
      envType: "node",
      action: "setupPath",
      status: "blocked",
      providerId: "fnm",
      projectPath: null,
      error: "Add the shim directory to PATH before continuing.",
      updatedAt: 3,
    };

    render(<EnvironmentWorkflowBanner envType="node" t={t} />);

    expect(screen.getByText("PATH setup is blocked.")).toBeInTheDocument();
    expect(
      screen.getByText("Error: Add the shim directory to PATH before continuing."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Action is blocked. Check requirements and try again."),
    ).toBeInTheDocument();
  });

  it("renders a context-only banner and clears workflow context", async () => {
    const user = userEvent.setup();
    mockStoreState.workflowContext = {
      envType: "node",
      origin: "detail",
      returnHref: "/environments",
      projectPath: "/workspace/app",
      providerId: "fnm",
      updatedAt: 4,
    };
    mockStoreState.workflowAction = null;

    render(<EnvironmentWorkflowBanner envType="node" t={t} />);

    expect(screen.getByText("Workflow context for Node.js")).toBeInTheDocument();
    expect(screen.getByText("Opened from Environment details.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear context" }));

    expect(mockClearWorkflowContext).toHaveBeenCalled();
  });

  it("renders error state actions and lets the user refresh or dismiss", async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    mockStoreState.workflowAction = {
      envType: "node",
      action: "refresh",
      status: "error",
      providerId: "fnm",
      projectPath: "/workspace/app",
      error: "Refresh timed out.",
      updatedAt: 5,
    };

    render(<EnvironmentWorkflowBanner envType="node" onRefresh={onRefresh} t={t} />);

    expect(screen.getByText("Refresh failed.")).toBeInTheDocument();
    expect(screen.getByText("The last action failed.")).toBeInTheDocument();
    expect(screen.getByText("Error: Refresh timed out.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onRefresh).toHaveBeenCalled();
    expect(mockClearWorkflowAction).toHaveBeenCalled();
  });

  it("returns null when neither context nor action matches the current env type", () => {
    mockStoreState.workflowContext = {
      envType: "python",
      origin: "direct",
      returnHref: "/",
      projectPath: null,
      providerId: "pyenv",
      updatedAt: 6,
    };
    mockStoreState.workflowAction = {
      envType: "python",
      action: "install",
      status: "running",
      providerId: "pyenv",
      projectPath: null,
      updatedAt: 7,
    };

    const { container } = render(<EnvironmentWorkflowBanner envType="node" t={t} />);

    expect(container).toBeEmptyDOMElement();
  });
});

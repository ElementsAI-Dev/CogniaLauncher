import { render, screen } from "@testing-library/react";
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
      "environments.workflow.origin.overview": "Environment overview",
      "environments.workflow.hint.success": "Last action completed successfully.",
      "environments.workflow.hint.blocked": "Action is blocked. Check requirements and try again.",
      "environments.workflow.action.applyProfile.success": "Profile applied.",
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
});

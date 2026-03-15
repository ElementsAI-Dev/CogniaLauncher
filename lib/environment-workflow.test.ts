import {
  createBlockedWorkflowAction,
  resolveWorkflowProviderSelection,
} from "./environment-workflow";

describe("environment workflow helpers", () => {
  const providers = [
    { id: "fnm", env_type: "node" },
    { id: "nvm", env_type: "node" },
    { id: "pyenv", env_type: "python" },
  ];

  it("keeps the persisted provider selection when it remains compatible", () => {
    const providerId = resolveWorkflowProviderSelection({
      envType: "node",
      selectedProviders: { node: "fnm" },
      availableProviders: providers,
      fallbackProviderId: "nvm",
    });

    expect(providerId).toBe("fnm");
  });

  it("falls back to an explicit compatible provider when persisted selection is stale", () => {
    const providerId = resolveWorkflowProviderSelection({
      envType: "node",
      selectedProviders: { node: "volta" },
      availableProviders: providers,
      fallbackProviderId: "nvm",
    });

    expect(providerId).toBe("nvm");
  });

  it("falls back to the first compatible provider when persisted and explicit providers are stale", () => {
    const providerId = resolveWorkflowProviderSelection({
      envType: "node",
      selectedProviders: { node: "volta" },
      availableProviders: providers,
      fallbackProviderId: "asdf",
    });

    expect(providerId).toBe("fnm");
  });

  it("creates blocked workflow actions using the logical environment type", () => {
    const action = createBlockedWorkflowAction({
      envType: "fnm",
      action: "setLocal",
      availableProviders: providers,
      providerId: "fnm",
      projectPath: null,
      reason: "Choose a project path before setting a local version.",
    });

    expect(action).toEqual(
      expect.objectContaining({
        envType: "node",
        action: "setLocal",
        status: "blocked",
        providerId: "fnm",
        projectPath: null,
        error: "Choose a project path before setting a local version.",
      }),
    );
    expect(action.updatedAt).toEqual(expect.any(Number));
  });
});

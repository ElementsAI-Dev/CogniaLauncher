import {
  createBlockedWorkflowAction,
  getLogicalEnvType,
  pruneWorkflowSelectedProviders,
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

  it("falls back to the logical environment type when no compatible providers remain", () => {
    const providerId = resolveWorkflowProviderSelection({
      envType: "bun",
      selectedProviders: { bun: "missing-provider" },
      availableProviders: providers,
      fallbackProviderId: null,
    });

    expect(providerId).toBe("bun");
  });

  it("maps provider aliases and unknown values to a logical environment type", () => {
    expect(getLogicalEnvType("system-node")).toBe("node");
    expect(getLogicalEnvType("custom-provider")).toBe("custom-provider");
  });

  it("prunes selected providers that are no longer compatible", () => {
    expect(pruneWorkflowSelectedProviders(
      {
        node: "fnm",
        python: "pyenv",
        java: "sdkman",
      },
      providers,
    )).toEqual({
      node: "fnm",
      python: "pyenv",
    });
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

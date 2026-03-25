import {
  deriveCleanTypeMaintenanceMetadata,
  deriveExternalCacheMaintenanceMetadata,
} from "./maintenance";

describe("cache maintenance planner", () => {
  it("marks default downloads as preview-first and preserves the resolved root", () => {
    expect(
      deriveCleanTypeMaintenanceMetadata("default_downloads", {
        defaultDownloadsRoot: "/home/user/Downloads",
      }),
    ).toEqual(
      expect.objectContaining({
        scopeKind: "default_downloads",
        cleanupMode: "preview_required",
        defaultDownloadsRoot: "/home/user/Downloads",
      }),
    );
  });

  it("marks external command-backed caches as direct-clean-only", () => {
    expect(
      deriveExternalCacheMaintenanceMetadata(
        {
          provider: "npm",
          displayName: "npm Cache",
          cachePath: "/tmp/npm",
          size: 1024,
          sizeHuman: "1 KB",
          isAvailable: true,
          canClean: true,
          category: "package_manager",
          scopeType: "external",
          cleanupMode: "direct_clean_only",
          isCustom: false,
        },
        {
          provider: "npm",
          displayName: "npm Cache",
          cachePath: "/tmp/npm",
          exists: true,
          size: 1024,
          sizeHuman: "1 KB",
          isAvailable: true,
          hasCleanCommand: true,
          cleanCommand: "npm cache clean --force",
          envVarsChecked: ["npm_config_cache"],
          scopeType: "external",
          cleanupMode: "direct_clean_only",
          isCustom: false,
        },
      ),
    ).toEqual(
      expect.objectContaining({
        scopeKind: "external",
        cleanupMode: "direct_clean_only",
        explanationKey: "cache.externalCleanupDirectCommand",
      }),
    );
  });

  it("marks unavailable custom caches as disabled", () => {
    expect(
      deriveExternalCacheMaintenanceMetadata({
        provider: "custom_docs",
        displayName: "Docs Cache",
        cachePath: "/tmp/docs",
        size: 0,
        sizeHuman: "0 B",
        isAvailable: false,
        canClean: false,
        category: "devtools",
        detectionState: "error",
        detectionReason: "path_not_directory",
        scopeType: "custom",
        cleanupMode: "disabled",
        isCustom: true,
      }),
    ).toEqual(
      expect.objectContaining({
        scopeKind: "custom",
        cleanupMode: "disabled",
        explanationKey: "cache.externalCleanupDisabledCustom",
      }),
    );
  });
});

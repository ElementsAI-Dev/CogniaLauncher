import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContractParity } from "../scripts/check-contract-lib.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = path.resolve(testDir, "..");

describe("plugin-sdk contract checks", () => {
  it("contract checker command succeeds against repo sources", () => {
    const scriptPath = path.join(sdkDir, "scripts", "check-contract.mjs");
    const result = spawnSync("node", [scriptPath, "--json"], {
      cwd: sdkDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.stats.contractCount).toBeGreaterThanOrEqual(38);
    expect(parsed.errors).toHaveLength(0);
  });

  it("contract validation reports undeclared wrapper call", () => {
    const result = validateContractParity({
      contractFunctions: [
        { name: "cognia_http_request", stability: "stable" },
        {
          name: "cognia_http_get",
          stability: "compat",
          preferred: "cognia_http_request",
        },
      ],
      runtimeFunctions: ["cognia_http_get", "cognia_http_request"],
      declarationFunctions: ["cognia_http_get", "cognia_http_request"],
      wrapperFunctions: ["cognia_http_get", "cognia_http_delete"],
    });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((line) =>
        line.includes("Wrapper calls undeclared functions: cognia_http_delete"),
      ),
    ).toBe(true);
  });
});

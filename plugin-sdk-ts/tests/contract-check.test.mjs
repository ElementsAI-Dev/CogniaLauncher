import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContractParity } from "../scripts/check-contract-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = path.resolve(__dirname, "..");

test("contract checker command succeeds against repo sources", () => {
  const scriptPath = path.join(sdkDir, "scripts", "check-contract.mjs");
  const result = spawnSync("node", [scriptPath, "--json"], {
    cwd: sdkDir,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.stats.contractCount >= 38, true);
  assert.equal(parsed.errors.length, 0);
});

test("contract validation reports undeclared wrapper call", () => {
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

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((line) =>
      line.includes("Wrapper calls undeclared functions: cognia_http_delete"),
    ),
    true,
  );
});

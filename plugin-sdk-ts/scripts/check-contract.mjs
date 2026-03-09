#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  loadContract,
  parseDeclarationFunctions,
  parseRuntimeFunctions,
  parseWrapperFunctions,
  validateContractParity,
} from "./check-contract-lib.mjs";

function asAbs(baseDir, relativePath) {
  return path.resolve(baseDir, relativePath);
}

function printTextReport(result, contractPath) {
  console.log("Cognia plugin SDK host contract check");
  console.log(`Contract: ${contractPath}`);
  console.log(
    `Counts: contract=${result.stats.contractCount}, runtime=${result.stats.runtimeCount}, declaration=${result.stats.declarationCount}, wrappers=${result.stats.wrapperCount}`,
  );

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }

  if (result.ok) {
    console.log("");
    console.log("OK: runtime registration, declaration, and SDK wrappers are aligned.");
  }
}

function main() {
  const argv = new Set(process.argv.slice(2));
  const jsonMode = argv.has("--json");

  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const sdkDir = path.resolve(thisDir, "..");
  const contractPath = asAbs(sdkDir, "host-contract.json");
  const contract = loadContract(contractPath);

  const runtimePath = asAbs(sdkDir, contract.runtimeSource);
  const declarationPath = asAbs(sdkDir, contract.declarationSource);
  const srcDirPath = asAbs(sdkDir, "src");

  const result = validateContractParity({
    contractFunctions: contract.functions,
    runtimeFunctions: parseRuntimeFunctions(runtimePath),
    declarationFunctions: parseDeclarationFunctions(declarationPath),
    wrapperFunctions: parseWrapperFunctions(srcDirPath),
  });

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          errors: result.errors,
          warnings: result.warnings,
          stats: result.stats,
          details: result.details,
        },
        null,
        2,
      ),
    );
  } else {
    printTextReport(result, contractPath);
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main();

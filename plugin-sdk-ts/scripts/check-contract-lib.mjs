import fs from "node:fs";
import path from "node:path";

const RUNTIME_FN_RE = /Function::new\(\s*"(?<name>cognia_[a-z0-9_]+)"/g;
const DTS_FN_RE = /^\s*(?<name>cognia_[a-z0-9_]+)\(ptr: I64\): I64;/gm;
const WRAPPER_FN_RE =
  /callHost(?:Json)?(?:<[^>]+>)?\(\s*["'](?<name>cognia_[a-z0-9_]+)["']/g;

const SRC_EXTS = new Set([".ts", ".tsx", ".mts", ".cts"]);

function toSortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function collectMatches(content, regex) {
  const names = [];
  for (const match of content.matchAll(regex)) {
    const name = match.groups?.name;
    if (name) names.push(name);
  }
  return toSortedUnique(names);
}

function collectSourceFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (SRC_EXTS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

export function loadContract(contractPath) {
  const raw = fs.readFileSync(contractPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed;
}

export function parseRuntimeFunctions(runtimeFilePath) {
  const content = fs.readFileSync(runtimeFilePath, "utf8");
  return collectMatches(content, RUNTIME_FN_RE);
}

export function parseDeclarationFunctions(declarationPath) {
  const content = fs.readFileSync(declarationPath, "utf8");
  return collectMatches(content, DTS_FN_RE);
}

export function parseWrapperFunctions(srcDirPath) {
  const files = collectSourceFiles(srcDirPath);
  const allNames = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    allNames.push(...collectMatches(content, WRAPPER_FN_RE));
  }
  return toSortedUnique(allNames);
}

function diff(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((name) => !actualSet.has(name)),
    extra: actual.filter((name) => !expectedSet.has(name)),
  };
}

function asSet(items) {
  return new Set(items);
}

export function validateContractParity({
  contractFunctions,
  runtimeFunctions,
  declarationFunctions,
  wrapperFunctions,
}) {
  const errors = [];
  const warnings = [];

  const contractNames = contractFunctions.map((item) => item.name);
  const contractNameSet = asSet(contractNames);

  const dupCheckSet = new Set();
  for (const name of contractNames) {
    if (dupCheckSet.has(name)) {
      errors.push(`Contract duplicates function: ${name}`);
    }
    dupCheckSet.add(name);
  }

  for (const item of contractFunctions) {
    if (item.stability === "compat") {
      if (!item.preferred) {
        errors.push(`Compatibility function '${item.name}' missing 'preferred' field`);
        continue;
      }
      if (!contractNameSet.has(item.preferred)) {
        errors.push(
          `Compatibility function '${item.name}' points to unknown preferred target '${item.preferred}'`,
        );
      }
      if (item.name === item.preferred) {
        errors.push(
          `Compatibility function '${item.name}' cannot point to itself as preferred target`,
        );
      }
    }
  }

  const runtimeDiff = diff(contractNames, runtimeFunctions);
  const declarationDiff = diff(contractNames, declarationFunctions);
  const wrapperUnknown = wrapperFunctions.filter(
    (name) => !contractNameSet.has(name),
  );

  if (runtimeDiff.missing.length > 0) {
    errors.push(
      `Missing in runtime registration (from contract): ${runtimeDiff.missing.join(", ")}`,
    );
  }
  if (runtimeDiff.extra.length > 0) {
    errors.push(
      `Unexpected runtime registration not in contract: ${runtimeDiff.extra.join(", ")}`,
    );
  }
  if (declarationDiff.missing.length > 0) {
    errors.push(
      `Missing in TypeScript declaration (from contract): ${declarationDiff.missing.join(", ")}`,
    );
  }
  if (declarationDiff.extra.length > 0) {
    errors.push(
      `Unexpected declaration not in contract: ${declarationDiff.extra.join(", ")}`,
    );
  }
  if (wrapperUnknown.length > 0) {
    errors.push(
      `Wrapper calls undeclared functions: ${wrapperUnknown.join(", ")}`,
    );
  }

  const compatNames = contractFunctions
    .filter((item) => item.stability === "compat")
    .map((item) => item.name);
  const wrappersUsingCompat = wrapperFunctions.filter((name) =>
    compatNames.includes(name),
  );
  if (wrappersUsingCompat.length > 0) {
    warnings.push(
      `Wrapper currently uses compatibility aliases: ${wrappersUsingCompat.join(", ")}`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      contractCount: contractNames.length,
      runtimeCount: runtimeFunctions.length,
      declarationCount: declarationFunctions.length,
      wrapperCount: wrapperFunctions.length,
      compatibilityAliasCount: compatNames.length,
    },
    details: {
      runtimeDiff,
      declarationDiff,
      wrapperUnknown,
      wrappersUsingCompat,
    },
  };
}

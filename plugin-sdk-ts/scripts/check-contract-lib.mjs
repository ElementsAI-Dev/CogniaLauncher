import fs from "node:fs";
import path from "node:path";

const RUNTIME_FN_RE = /Function::new\(\s*"(?<name>cognia_[a-z0-9_]+)"/g;
const DTS_FN_RE = /^\s*(?<name>cognia_[a-z0-9_]+)\(ptr: I64\): I64;/gm;
const WRAPPER_FN_RE =
  /callHost(?:Json)?(?:<[^>]+>)?\(\s*["'](?<name>cognia_[a-z0-9_]+)["']/g;
const RUST_DECL_FN_RE = /^\s*pub fn (?<name>cognia_[a-z0-9_]+)\(input: String\) -> String;/gm;
const RUST_WRAPPER_FN_RE = /host::(?<name>cognia_[a-z0-9_]+)\(/g;

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

export function parseRustDeclarationFunctions(declarationPath) {
  const content = fs.readFileSync(declarationPath, 'utf8');
  return collectMatches(content, RUST_DECL_FN_RE);
}

export function parseRustWrapperFunctions(srcDirPath) {
  const files = [];
  const stack = [srcDirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.name.endsWith('.rs')) {
        files.push(fullPath);
      }
    }
  }
  const allNames = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    allNames.push(...collectMatches(content, RUST_WRAPPER_FN_RE));
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

function inferPluginPointId(name) {
  if (name === 'cognia_event_emit' || name === 'cognia_get_plugin_id') {
    return 'event-listener';
  }
  if (name === 'cognia_log') {
    return 'log-listener';
  }
  return 'tool-runtime';
}

function withPluginPoint(names) {
  return names.map((name) => `${name} [${inferPluginPointId(name)}]`);
}

export function validateContractParity({
  contractFunctions,
  runtimeFunctions,
  declarationFunctions,
  wrapperFunctions,
  rustDeclarationFunctions = [],
  rustWrapperFunctions = [],
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
  const rustDeclarationDiff = diff(contractNames, rustDeclarationFunctions);
  const wrapperUnknown = wrapperFunctions.filter(
    (name) => !contractNameSet.has(name),
  );
  const rustWrapperUnknown = rustWrapperFunctions.filter(
    (name) => !contractNameSet.has(name),
  );

  if (runtimeDiff.missing.length > 0) {
    errors.push(
      `Missing in runtime registration (from contract): ${withPluginPoint(runtimeDiff.missing).join(", ")}`,
    );
  }
  if (runtimeDiff.extra.length > 0) {
    errors.push(
      `Unexpected runtime registration not in contract: ${withPluginPoint(runtimeDiff.extra).join(", ")}`,
    );
  }
  if (declarationDiff.missing.length > 0) {
    errors.push(
      `Missing in TypeScript declaration (from contract): ${withPluginPoint(declarationDiff.missing).join(", ")}`,
    );
  }
  if (declarationDiff.extra.length > 0) {
    errors.push(
      `Unexpected declaration not in contract: ${withPluginPoint(declarationDiff.extra).join(", ")}`,
    );
  }
  if (rustDeclarationDiff.missing.length > 0) {
    errors.push(
      `Missing in Rust declaration (from contract): ${withPluginPoint(rustDeclarationDiff.missing).join(", ")}`,
    );
  }
  if (rustDeclarationDiff.extra.length > 0) {
    errors.push(
      `Unexpected Rust declaration not in contract: ${withPluginPoint(rustDeclarationDiff.extra).join(", ")}`,
    );
  }
  if (wrapperUnknown.length > 0) {
    errors.push(
      `TypeScript wrapper calls undeclared functions: ${withPluginPoint(wrapperUnknown).join(", ")}`,
    );
  }
  if (rustWrapperUnknown.length > 0) {
    errors.push(
      `Rust wrapper calls undeclared functions: ${withPluginPoint(rustWrapperUnknown).join(", ")}`,
    );
  }

  const compatNames = contractFunctions
    .filter((item) => item.stability === "compat")
    .map((item) => item.name);
  const wrappersUsingCompat = wrapperFunctions.filter((name) =>
    compatNames.includes(name),
  );
  const rustWrappersUsingCompat = rustWrapperFunctions.filter((name) =>
    compatNames.includes(name),
  );
  if (wrappersUsingCompat.length > 0) {
    warnings.push(
      `Wrapper currently uses compatibility aliases: ${wrappersUsingCompat.join(", ")}`,
    );
  }
  if (rustWrappersUsingCompat.length > 0) {
    warnings.push(
      `Rust wrapper currently uses compatibility aliases: ${rustWrappersUsingCompat.join(", ")}`,
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
      rustDeclarationCount: rustDeclarationFunctions.length,
      rustWrapperCount: rustWrapperFunctions.length,
      compatibilityAliasCount: compatNames.length,
    },
    details: {
      runtimeDiff,
      declarationDiff,
      rustDeclarationDiff,
      wrapperUnknown,
      rustWrapperUnknown,
      wrappersUsingCompat,
      rustWrappersUsingCompat,
    },
  };
}

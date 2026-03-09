import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const PLUGINS_ROOT = path.join(REPO_ROOT, 'plugins');
export const CATALOG_PATH = path.join(PLUGINS_ROOT, 'manifest.json');
export const SDK_CAPABILITY_MATRIX_PATH = path.join(PLUGINS_ROOT, 'sdk-capability-matrix.json');
export const SUPPORTED_FRAMEWORKS = ['rust', 'typescript'];
export const DEFAULT_SUPPORTED_SDK_CAPABILITIES = [
  'clipboard',
  'config',
  'env',
  'event',
  'fs',
  'http',
  'i18n',
  'log',
  'notification',
  'pkg',
  'platform',
  'process',
  'ui',
];

export function readCatalog() {
  const raw = readFileSync(CATALOG_PATH, 'utf8');
  return JSON.parse(raw);
}

export function writeCatalog(catalog) {
  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

export function readSdkCapabilityMatrix(options = {}) {
  const matrixPath = resolveRepoPath('plugins/sdk-capability-matrix.json', options);
  ensureFileExists(matrixPath, 'SDK capability matrix');
  return JSON.parse(readFileSync(matrixPath, 'utf8'));
}

function ensureRequiredString(value, field, pluginId) {
  if (typeof value !== 'string') {
    throw new Error(`Plugin "${pluginId}" missing required string field: ${field}`);
  }
  if (value.trim() === '') {
    throw new Error(`Plugin "${pluginId}" has empty required field: ${field}`);
  }
}

export function validateCatalogShape(catalog) {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('Catalog must be an object.');
  }
  if (!Array.isArray(catalog.plugins) || catalog.plugins.length === 0) {
    throw new Error('Catalog must contain non-empty plugins[].');
  }

  const seen = new Set();
  for (const plugin of catalog.plugins) {
    const pluginId = plugin.id ?? '<unknown>';
    for (const required of ['id', 'name', 'framework', 'version', 'pluginDir', 'artifact', 'checksumSha256']) {
      ensureRequiredString(plugin[required], required, pluginId);
    }
    if (seen.has(plugin.id)) {
      throw new Error(`Duplicate plugin id in catalog: ${plugin.id}`);
    }
    seen.add(plugin.id);
    if (!SUPPORTED_FRAMEWORKS.includes(plugin.framework)) {
      throw new Error(`Unsupported framework "${plugin.framework}" for plugin "${plugin.id}"`);
    }

    if (plugin.framework === 'typescript') {
      ensureRequiredString(plugin.packageName, 'packageName', plugin.id);
      ensureRequiredString(plugin.testFile, 'testFile', plugin.id);
    } else {
      ensureRequiredString(plugin.rustCrate, 'rustCrate', plugin.id);
    }

    if (!plugin.onboarding || typeof plugin.onboarding !== 'object') {
      throw new Error(`Plugin "${plugin.id}" missing onboarding metadata.`);
    }
    for (const required of ['profile', 'catalogPath', 'checksumCommand', 'validationCommand']) {
      ensureRequiredString(plugin.onboarding[required], `onboarding.${required}`, plugin.id);
    }
    if (plugin.onboarding.profile !== 'builtin') {
      throw new Error(`Plugin "${plugin.id}" must declare onboarding.profile="builtin".`);
    }
  }
}

function ensureStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  const normalized = value.map((item) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new Error(`${label} must contain non-empty string values.`);
    }
    return item.trim();
  });
  return [...new Set(normalized)];
}

export function validateSdkCapabilityMatrixShape(matrix, catalog) {
  if (!matrix || typeof matrix !== 'object') {
    throw new Error('SDK capability matrix must be an object.');
  }

  if (matrix.schemaVersion !== 1) {
    throw new Error(`Unsupported SDK capability matrix schemaVersion: ${matrix.schemaVersion}`);
  }

  const requiredPluginIds = ensureStringArray(matrix.requiredPluginIds ?? [], 'requiredPluginIds');
  const matrixPlugins = Array.isArray(matrix.plugins) ? matrix.plugins : null;
  if (!matrixPlugins || matrixPlugins.length === 0) {
    throw new Error('SDK capability matrix must contain non-empty plugins[].');
  }

  const supportedCapabilities = new Set(
    ensureStringArray(
      matrix.supportedSdkCapabilities ?? DEFAULT_SUPPORTED_SDK_CAPABILITIES,
      'supportedSdkCapabilities',
    ),
  );

  const seenPluginIds = new Set();
  for (const entry of matrixPlugins) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('SDK capability matrix plugins[] entries must be objects.');
    }
    ensureRequiredString(entry.id, 'id', '<matrix-entry>');
    if (seenPluginIds.has(entry.id)) {
      throw new Error(`Duplicate plugin id in SDK capability matrix: ${entry.id}`);
    }
    seenPluginIds.add(entry.id);

    const sdkCapabilities = ensureStringArray(entry.sdkCapabilities ?? [], `plugins[${entry.id}].sdkCapabilities`);
    const expectedPermissions = ensureStringArray(entry.expectedPermissions ?? [], `plugins[${entry.id}].expectedPermissions`);
    const primaryEntrypoints = ensureStringArray(entry.primaryEntrypoints ?? [], `plugins[${entry.id}].primaryEntrypoints`);

    if (sdkCapabilities.length === 0) {
      throw new Error(`plugins[${entry.id}].sdkCapabilities must not be empty.`);
    }
    if (expectedPermissions.length === 0) {
      throw new Error(`plugins[${entry.id}].expectedPermissions must not be empty.`);
    }
    if (primaryEntrypoints.length === 0) {
      throw new Error(`plugins[${entry.id}].primaryEntrypoints must not be empty.`);
    }

    const unsupported = sdkCapabilities.filter((capability) => !supportedCapabilities.has(capability));
    if (unsupported.length > 0) {
      throw new Error(
        `plugins[${entry.id}] has unsupported sdkCapabilities: ${unsupported.join(', ')}`,
      );
    }
  }

  for (const requiredPluginId of requiredPluginIds) {
    if (!seenPluginIds.has(requiredPluginId)) {
      throw new Error(
        `SDK capability matrix missing plugins[] entry for required plugin id: ${requiredPluginId}`,
      );
    }
  }

  const catalogPluginIds = new Set((catalog?.plugins ?? []).map((plugin) => plugin.id));
  for (const requiredPluginId of requiredPluginIds) {
    if (!catalogPluginIds.has(requiredPluginId)) {
      throw new Error(
        `SDK capability matrix requiredPluginId not found in plugins/manifest.json: ${requiredPluginId}`,
      );
    }
  }
}

export function resolvePluginRoot(plugin, options = {}) {
  const pluginsRoot = path.join(options.repoRoot ?? REPO_ROOT, 'plugins');
  return path.join(pluginsRoot, plugin.pluginDir);
}

export function resolveArtifactPath(plugin, options = {}) {
  return path.join(resolvePluginRoot(plugin, options), plugin.artifact);
}

export function resolveRepoPath(repoRelativePath, options = {}) {
  return path.join(options.repoRoot ?? REPO_ROOT, repoRelativePath);
}

export function sha256File(filePath) {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

export function ensureFileExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function trimCapturedOutput(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-10)
    .join('\n');
}

export function runCommand(command, args, options = {}) {
  const useShell = process.platform === 'win32' && command === 'pnpm';
  const quiet = options.quiet ?? false;
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    shell: useShell,
    env: process.env,
  });
  const stdout = quiet ? result.stdout?.toString('utf8') ?? '' : '';
  const stderr = quiet ? result.stderr?.toString('utf8') ?? '' : '';

  if (result.error) {
    throw new Error(`Failed to start command: ${command} ${args.join(' ')} (${result.error.message})`);
  }
  if (result.status !== 0) {
    const details = trimCapturedOutput([stdout, stderr].filter(Boolean).join('\n'));
    throw new Error(
      `Command failed (${result.status ?? 'unknown'}): ${command} ${args.join(' ')}${details ? `\n${details}` : ''}`,
    );
  }

  return { status: result.status ?? 0, stdout, stderr };
}

function readSelectorValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

export function parseMaintainerArgs(argv, options = {}) {
  const parsed = {
    pluginIds: [],
    frameworks: [],
    json: false,
    skipBuild: false,
    skipTests: false,
    filtered: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--plugin') {
      parsed.pluginIds.push(readSelectorValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--plugin=')) {
      parsed.pluginIds.push(arg.slice('--plugin='.length));
      continue;
    }
    if (arg === '--framework') {
      parsed.frameworks.push(readSelectorValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--framework=')) {
      parsed.frameworks.push(arg.slice('--framework='.length));
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--skip-build') {
      if (!options.allowSkipBuild) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      parsed.skipBuild = true;
      continue;
    }
    if (arg === '--skip-tests') {
      if (!options.allowSkipTests) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      parsed.skipTests = true;
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }

  parsed.pluginIds = [...new Set(parsed.pluginIds.map((value) => value.trim()).filter(Boolean))];
  parsed.frameworks = [...new Set(parsed.frameworks.map((value) => value.trim()).filter(Boolean))];

  for (const framework of parsed.frameworks) {
    if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
      throw new Error(`Unsupported framework selector: ${framework}`);
    }
  }

  parsed.filtered = parsed.pluginIds.length > 0 || parsed.frameworks.length > 0;
  return parsed;
}

export function resolveSelectedPlugins(catalog, parsedArgs) {
  validateCatalogShape(catalog);

  const plugins = [...catalog.plugins];
  if (!parsedArgs.filtered) {
    return {
      filtered: false,
      selectors: {
        plugins: [],
        frameworks: [],
      },
      selected: plugins,
      skipped: [],
    };
  }

  const catalogIds = new Set(plugins.map((plugin) => plugin.id));
  const unknownPluginIds = parsedArgs.pluginIds.filter((pluginId) => !catalogIds.has(pluginId));
  if (unknownPluginIds.length > 0) {
    throw new Error(`Unknown plugin selector: ${unknownPluginIds.join(', ')}`);
  }

  const selectedById = new Set(parsedArgs.pluginIds);
  const selectedByFramework = new Set(parsedArgs.frameworks);
  const selected = plugins.filter(
    (plugin) => selectedById.has(plugin.id) || selectedByFramework.has(plugin.framework),
  );

  if (selected.length === 0) {
    throw new Error('Requested target set resolved to no catalog entries.');
  }

  const selectedIds = new Set(selected.map((plugin) => plugin.id));
  const skipped = plugins.filter((plugin) => !selectedIds.has(plugin.id));

  return {
    filtered: true,
    selectors: {
      plugins: [...parsedArgs.pluginIds],
      frameworks: [...parsedArgs.frameworks],
    },
    selected,
    skipped,
  };
}

export function createRunSummary(command, selection, options = {}) {
  return {
    command,
    json: options.json ?? false,
    filtered: selection.filtered,
    selectors: {
      plugins: [...(selection.selectors?.plugins ?? [])],
      frameworks: [...(selection.selectors?.frameworks ?? [])],
    },
    selected: selection.selected.map((plugin) => plugin.id),
    skipped: selection.skipped.map((plugin) => plugin.id),
    successes: [],
    failures: [],
    guidance: [],
    status: 'ok',
  };
}

export function createFailureSummary(command, parsedArgs, catalog, error) {
  const summary = createRunSummary(
    command,
    {
      filtered: parsedArgs?.filtered ?? false,
      selectors: {
        plugins: [...(parsedArgs?.pluginIds ?? [])],
        frameworks: [...(parsedArgs?.frameworks ?? [])],
      },
      selected: [],
      skipped: catalog?.plugins ?? [],
    },
    { json: parsedArgs?.json ?? false },
  );
  recordRunFailure(summary, null, error);
  return finalizeRunSummary(summary);
}

export function recordRunSuccess(summary, plugin, details = {}) {
  summary.successes.push({
    id: typeof plugin === 'string' ? plugin : plugin.id,
    ...details,
  });
}

export function recordRunFailure(summary, plugin, error, details = {}) {
  summary.failures.push({
    id: typeof plugin === 'string' ? plugin : plugin?.id ?? null,
    message: error instanceof Error ? error.message : String(error),
    ...details,
  });
}

function buildRunGuidance(summary) {
  const guidance = [];

  if (summary.filtered) {
    guidance.push('Filtered run covered only the selected built-in plugins. Re-run without selectors for full-suite coverage.');
  }

  if (summary.failures.length > 0) {
    guidance.push(`Resolve the reported plugin failures and rerun pnpm plugins:${summary.command}.`);
  } else if (summary.command === 'checksums' && summary.successes.length > 0) {
    guidance.push('Review and commit the updated checksum entries in plugins/manifest.json.');
  }

  return guidance;
}

export function finalizeRunSummary(summary) {
  const finalized = summary;
  finalized.counts = {
    selected: finalized.selected.length,
    skipped: finalized.skipped.length,
    succeeded: finalized.successes.length,
    failed: finalized.failures.length,
  };
  finalized.status = finalized.failures.length > 0 ? 'failed' : 'ok';
  finalized.guidance = buildRunGuidance(finalized);
  return finalized;
}

export function printRunSummary(summary, options = {}) {
  const finalized = summary.counts ? summary : finalizeRunSummary(summary);
  const json = options.json ?? finalized.json;

  if (json) {
    console.log(JSON.stringify(finalized, null, 2));
    return finalized;
  }

  const prefix = `[builtins][${finalized.command}]`;
  console.log(
    `${prefix} summary status=${finalized.status} filtered=${finalized.filtered} selected=${finalized.counts.selected} skipped=${finalized.counts.skipped} succeeded=${finalized.counts.succeeded} failed=${finalized.counts.failed}`,
  );

  if (finalized.selected.length > 0) {
    console.log(`${prefix} selected: ${finalized.selected.join(', ')}`);
  }
  if (finalized.skipped.length > 0) {
    console.log(`${prefix} skipped: ${finalized.skipped.join(', ')}`);
  }
  for (const failure of finalized.failures) {
    console.error(`${prefix} failure ${failure.id ?? 'run'}: ${failure.message}`);
  }
  for (const guidance of finalized.guidance) {
    console.log(`${prefix} next: ${guidance}`);
  }

  return finalized;
}

export function parseSimpleToml(raw) {
  const sections = {};
  let currentSection = '';

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const arraySectionMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);
    if (arraySectionMatch) {
      currentSection = `${arraySectionMatch[1]}[]`;
      sections[currentSection] ??= {};
      continue;
    }

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections[currentSection] ??= {};
      continue;
    }

    const quotedValueMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*"([^"]*)"$/);
    if (quotedValueMatch) {
      const [, key, value] = quotedValueMatch;
      sections[currentSection] ??= {};
      sections[currentSection][key] = value;
    }
  }

  return sections;
}

function parseTomlSectionLines(raw, sectionName) {
  const lines = [];
  let inSection = false;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      inSection = sectionMatch[1] === sectionName;
      continue;
    }
    if (trimmed.startsWith('[[')) {
      inSection = false;
      continue;
    }
    if (inSection) {
      lines.push(trimmed);
    }
  }

  return lines;
}

export function parsePluginTomlEnabledPermissions(raw) {
  const permissions = new Set();
  for (const line of parseTomlSectionLines(raw, 'permissions')) {
    const assignment = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!assignment) {
      continue;
    }
    const [, key, valueRaw] = assignment;
    const value = valueRaw.trim();
    if (value === 'true') {
      permissions.add(key);
      continue;
    }
    if (value.startsWith('[')) {
      const items = [...value.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim()).filter(Boolean);
      if (items.length > 0) {
        permissions.add(key);
      }
      continue;
    }
    const quoted = value.match(/^"([^"]*)"$/);
    if (quoted && quoted[1].trim() !== '') {
      permissions.add(key);
    }
  }
  return [...permissions].sort();
}

export function parsePluginTomlEntrypoints(raw) {
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^entry\s*=\s*"([^"]+)"$/);
    if (match && match[1].trim() !== '') {
      entries.push(match[1].trim());
    }
  }
  return [...new Set(entries)];
}

export function validatePluginCapabilityMatrixEntry(plugin, matrix, options = {}) {
  const requiredPluginIds = new Set(ensureStringArray(matrix.requiredPluginIds ?? [], 'requiredPluginIds'));
  const matrixEntry = (matrix.plugins ?? []).find((entry) => entry.id === plugin.id);

  if (!matrixEntry) {
    if (requiredPluginIds.has(plugin.id)) {
      return [`${plugin.id} is required by sdk-capability-matrix but has no plugins[] entry.`];
    }
    return [];
  }

  const mismatches = [];
  const pluginTomlPath = path.join(resolvePluginRoot(plugin, options), 'plugin.toml');
  ensureFileExists(pluginTomlPath, `plugin.toml for ${plugin.id}`);
  const pluginTomlRaw = readFileSync(pluginTomlPath, 'utf8');

  const expectedPermissions = new Set(ensureStringArray(matrixEntry.expectedPermissions ?? [], `plugins[${plugin.id}].expectedPermissions`));
  const actualPermissions = new Set(parsePluginTomlEnabledPermissions(pluginTomlRaw));
  for (const permission of expectedPermissions) {
    if (!actualPermissions.has(permission)) {
      mismatches.push(
        `${plugin.id} expected permission '${permission}' is missing from plugin.toml [permissions].`,
      );
    }
  }
  for (const permission of actualPermissions) {
    if (!expectedPermissions.has(permission)) {
      mismatches.push(
        `${plugin.id} has undeclared permission '${permission}' (not listed in sdk-capability-matrix expectedPermissions).`,
      );
    }
  }

  const expectedEntrypoints = new Set(ensureStringArray(matrixEntry.primaryEntrypoints ?? [], `plugins[${plugin.id}].primaryEntrypoints`));
  const actualEntrypoints = new Set(parsePluginTomlEntrypoints(pluginTomlRaw));
  for (const entrypoint of expectedEntrypoints) {
    if (!actualEntrypoints.has(entrypoint)) {
      mismatches.push(
        `${plugin.id} expected entrypoint '${entrypoint}' is missing from plugin.toml [[tools]].entry.`,
      );
    }
  }

  const sourcePath = plugin.framework === 'typescript'
    ? path.join(resolvePluginRoot(plugin, options), 'src', 'index.ts')
    : path.join(resolvePluginRoot(plugin, options), 'src', 'lib.rs');
  ensureFileExists(sourcePath, `source file for ${plugin.id}`);
  const sourceText = readFileSync(sourcePath, 'utf8');
  for (const entrypoint of expectedEntrypoints) {
    if (!sourceText.includes(entrypoint)) {
      mismatches.push(
        `${plugin.id} source does not reference expected entrypoint '${entrypoint}'.`,
      );
    }
  }

  return mismatches;
}

function recordMetadataMismatch(mismatches, source, field, expected, actual) {
  if (expected === actual) {
    return;
  }
  mismatches.push({
    source,
    field,
    expected,
    actual: actual ?? null,
  });
}

export function validatePluginProjectMetadata(plugin, options = {}) {
  const pluginRoot = resolvePluginRoot(plugin, options);
  const mismatches = [];

  const pluginTomlPath = path.join(pluginRoot, 'plugin.toml');
  ensureFileExists(pluginTomlPath, `plugin.toml for ${plugin.id}`);
  const pluginToml = parseSimpleToml(readFileSync(pluginTomlPath, 'utf8'));

  recordMetadataMismatch(mismatches, 'plugin.toml', 'id', plugin.id, pluginToml.plugin?.id);
  recordMetadataMismatch(mismatches, 'plugin.toml', 'name', plugin.name, pluginToml.plugin?.name);
  recordMetadataMismatch(mismatches, 'plugin.toml', 'version', plugin.version, pluginToml.plugin?.version);

  if (plugin.framework === 'typescript') {
    const packageJsonPath = path.join(pluginRoot, 'package.json');
    ensureFileExists(packageJsonPath, `package.json for ${plugin.id}`);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    recordMetadataMismatch(mismatches, 'package.json', 'name', plugin.packageName, packageJson.name);
    recordMetadataMismatch(mismatches, 'package.json', 'version', plugin.version, packageJson.version);

    const testFilePath = resolveRepoPath(plugin.testFile, options);
    ensureFileExists(testFilePath, `testFile for ${plugin.id}`);
  } else {
    const cargoTomlPath = path.join(pluginRoot, 'Cargo.toml');
    ensureFileExists(cargoTomlPath, `Cargo.toml for ${plugin.id}`);
    const cargoToml = parseSimpleToml(readFileSync(cargoTomlPath, 'utf8'));

    const cargoCrateName = cargoToml.lib?.name ?? cargoToml.package?.name;
    recordMetadataMismatch(mismatches, 'Cargo.toml', 'crate', plugin.rustCrate, cargoCrateName);
    recordMetadataMismatch(mismatches, 'Cargo.toml', 'version', plugin.version, cargoToml.package?.version);
  }

  return mismatches;
}

export function formatMetadataDrift(plugin, mismatches) {
  return mismatches.map(
    (mismatch) =>
      `${plugin.id} metadata drift in ${mismatch.source} (${mismatch.field}): expected "${mismatch.expected}" but found "${mismatch.actual ?? '<missing>'}"`,
  );
}

export async function buildPlugin(plugin, options = {}) {
  const pluginRoot = resolvePluginRoot(plugin, options);
  const quiet = options.quiet ?? false;
  if (plugin.framework === 'typescript') {
    runCommand('pnpm', ['--filter', plugin.packageName, 'build'], {
      cwd: options.repoRoot ?? REPO_ROOT,
      quiet,
    });
    return;
  }

  const manifestPath = path.join(pluginRoot, 'Cargo.toml');
  ensureFileExists(manifestPath, 'Rust Cargo.toml');
  runCommand(
    'cargo',
    ['build', '--manifest-path', manifestPath, '--release', '--target', 'wasm32-unknown-unknown'],
    {
      cwd: options.repoRoot ?? REPO_ROOT,
      quiet,
    },
  );

  const releaseDir = path.join(pluginRoot, 'target', 'wasm32-unknown-unknown', 'release');
  const wasmFile = path.join(releaseDir, `${plugin.rustCrate}.wasm`);
  ensureFileExists(wasmFile, 'Built Rust wasm artifact');
  const artifactPath = resolveArtifactPath(plugin, options);
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await copyFile(wasmFile, artifactPath);
}

export function runPluginTests(plugin, options = {}) {
  const quiet = options.quiet ?? false;
  if (plugin.framework === 'typescript') {
    runCommand('pnpm', ['test', '--', '--runInBand', plugin.testFile], {
      cwd: options.repoRoot ?? REPO_ROOT,
      quiet,
    });
    return;
  }

  const manifestPath = path.join(resolvePluginRoot(plugin, options), 'Cargo.toml');
  runCommand('cargo', ['test', '--manifest-path', manifestPath], {
    cwd: options.repoRoot ?? REPO_ROOT,
    quiet,
  });
}

export async function listTopLevelPluginFiles(pluginRoot) {
  return readdir(pluginRoot, { withFileTypes: true });
}

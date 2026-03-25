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
export const SDK_USAGE_INVENTORY_PATH = path.join(PLUGINS_ROOT, 'sdk-usage-inventory.json');
export const EXTENSION_POINT_MATRIX_PATH = path.join(PLUGINS_ROOT, 'extension-point-matrix.json');
export const SUPPORTED_FRAMEWORKS = ['rust', 'typescript'];
export const DEFAULT_SUPPORTED_SDK_CAPABILITIES = [
  'batch',
  'cache',
  'clipboard',
  'config',
  'download',
  'env',
  'event',
  'fs',
  'git',
  'health',
  'http',
  'i18n',
  'launch',
  'log',
  'notification',
  'pkg',
  'platform',
  'process',
  'profiles',
  'shell',
  'ui',
  'wsl',
];
export const SDK_USAGE_PATH_TYPES = ['builtin-plugin', 'official-example', 'scaffold-workflow'];
export const SDK_USAGE_SURFACES = ['runtime', 'ink-authoring'];

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

export function readExtensionPointMatrix(options = {}) {
  const matrixPath = resolveRepoPath('plugins/extension-point-matrix.json', options);
  ensureFileExists(matrixPath, 'Plugin-point matrix');
  return JSON.parse(readFileSync(matrixPath, 'utf8'));
}

export function readSdkUsageInventory(options = {}) {
  const inventoryPath = resolveRepoPath('plugins/sdk-usage-inventory.json', options);
  ensureFileExists(inventoryPath, 'SDK usage inventory');
  return JSON.parse(readFileSync(inventoryPath, 'utf8'));
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

function equalStringSets(left, right) {
  const leftValues = [...left].sort();
  const rightValues = [...right].sort();
  return leftValues.length === rightValues.length
    && leftValues.every((value, index) => value === rightValues[index]);
}

function parseRustSdkCapabilityFamilies(raw) {
  return [...new Set(
    [...raw.matchAll(/^\s*pub mod ([a-z0-9_]+);\s*$/gm)]
      .map((match) => match[1])
      .filter((capability) => capability !== 'types'),
  )].sort();
}

function parseTypeScriptSdkCapabilityFamilies(raw) {
  return [...new Set(
    [...raw.matchAll(/^\s*export \* as ([a-z0-9_]+) from '\.\/[a-z0-9_]+';\s*$/gm)]
      .map((match) => match[1]),
  )].sort();
}

export function getOfficialSdkCapabilityFamilies(options = {}) {
  const rustPath = resolveRepoPath('plugin-sdk/src/lib.rs', options);
  const tsPath = resolveRepoPath('plugin-sdk-ts/src/index.ts', options);
  ensureFileExists(rustPath, 'Rust SDK entrypoint');
  ensureFileExists(tsPath, 'TypeScript SDK entrypoint');

  const rustCapabilities = parseRustSdkCapabilityFamilies(readFileSync(rustPath, 'utf8'));
  const tsCapabilities = parseTypeScriptSdkCapabilityFamilies(readFileSync(tsPath, 'utf8'));
  const rustOnly = rustCapabilities.filter((capability) => !tsCapabilities.includes(capability));
  const tsOnly = tsCapabilities.filter((capability) => !rustCapabilities.includes(capability));
  if (rustOnly.length > 0 || tsOnly.length > 0) {
    const parts = [];
    if (rustOnly.length > 0) {
      parts.push(`Rust-only: ${rustOnly.join(', ')}`);
    }
    if (tsOnly.length > 0) {
      parts.push(`TypeScript-only: ${tsOnly.join(', ')}`);
    }
    throw new Error(`Official SDK capability export drift detected. ${parts.join(' | ')}`);
  }

  return rustCapabilities;
}

function buildSdkUsageValidationError(errors) {
  return errors.join('\n');
}

export function validateSdkUsageInventoryShape(inventory, context = {}) {
  const errors = [];

  if (!inventory || typeof inventory !== 'object') {
    throw new Error('SDK usage inventory must be an object.');
  }
  if (inventory.schemaVersion !== 1) {
    throw new Error(`Unsupported SDK usage inventory schemaVersion: ${inventory.schemaVersion}`);
  }

  const officialCapabilities = ensureStringArray(
    context.officialCapabilities ?? getOfficialSdkCapabilityFamilies(context),
    'officialCapabilities',
  );
  const catalog = context.catalog ?? readCatalog();
  const sdkCapabilityMatrix = context.sdkCapabilityMatrix ?? readSdkCapabilityMatrix(context);
  const extensionPointMatrix = context.extensionPointMatrix ?? readExtensionPointMatrix(context);
  const pluginPointIds = new Set(
    Array.isArray(extensionPointMatrix?.pluginPoints)
      ? extensionPointMatrix.pluginPoints
        .map((point) => point?.id)
        .filter((value) => typeof value === 'string' && value.trim() !== '')
      : [],
  );

  const capabilityEntries = Array.isArray(inventory.capabilities) ? inventory.capabilities : null;
  if (!capabilityEntries || capabilityEntries.length === 0) {
    throw new Error('SDK usage inventory must contain non-empty capabilities[].');
  }

  const seenCapabilityIds = new Set();
  for (const entry of capabilityEntries) {
    if (!entry || typeof entry !== 'object') {
      errors.push('SDK usage inventory capabilities[] entries must be objects.');
      continue;
    }

    const capabilityId = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!capabilityId) {
      errors.push('SDK usage inventory capability entry missing non-empty id.');
      continue;
    }
    if (seenCapabilityIds.has(capabilityId)) {
      errors.push(`Duplicate SDK usage inventory capability id: ${capabilityId}`);
      continue;
    }
    seenCapabilityIds.add(capabilityId);

    if (!officialCapabilities.includes(capabilityId)) {
      errors.push(`SDK usage inventory contains unsupported capability id: ${capabilityId}`);
    }

    const permissionGuidance = ensureStringArray(
      entry.permissionGuidance ?? [],
      `capabilities[${capabilityId}].permissionGuidance`,
    );
    const hostPrerequisites = ensureStringArray(
      entry.hostPrerequisites ?? [],
      `capabilities[${capabilityId}].hostPrerequisites`,
    );
    void hostPrerequisites;

    const usagePaths = Array.isArray(entry.usagePaths) ? entry.usagePaths : null;
    if (!usagePaths || usagePaths.length === 0) {
      errors.push(`capabilities[${capabilityId}].usagePaths must contain at least one usage path.`);
      continue;
    }

    for (const [usageIndex, usagePath] of usagePaths.entries()) {
      if (!usagePath || typeof usagePath !== 'object') {
        errors.push(`capabilities[${capabilityId}].usagePaths[${usageIndex}] must be an object.`);
        continue;
      }

      const usageType = typeof usagePath.type === 'string' ? usagePath.type.trim() : '';
      const usageSurface = typeof usagePath.surface === 'string' ? usagePath.surface.trim() : 'runtime';
      const usageRefPath = typeof usagePath.path === 'string' ? usagePath.path.trim() : '';
      if (!SDK_USAGE_PATH_TYPES.includes(usageType)) {
        errors.push(
          `capabilities[${capabilityId}].usagePaths[${usageIndex}] has unsupported type '${usageType || '<missing>'}'.`,
        );
        continue;
      }
      if (!SDK_USAGE_SURFACES.includes(usageSurface)) {
        errors.push(
          `capabilities[${capabilityId}].usagePaths[${usageIndex}] has unsupported surface '${usageSurface || '<missing>'}'.`,
        );
        continue;
      }
      if (!usageRefPath) {
        errors.push(`capabilities[${capabilityId}].usagePaths[${usageIndex}] missing non-empty path.`);
        continue;
      }

      const displayName = typeof usagePath.displayName === 'string'
        ? usagePath.displayName.trim()
        : '';
      const launchCommand = typeof usagePath.launchCommand === 'string'
        ? usagePath.launchCommand.trim()
        : '';
      const localPrerequisites = ensureStringArray(
        usagePath.localPrerequisites ?? [],
        `capabilities[${capabilityId}].usagePaths[${usageIndex}].localPrerequisites`,
      );
      void localPrerequisites;

      if (usageSurface === 'ink-authoring') {
        if (!displayName) {
          errors.push(
            `${capabilityId} ink-authoring usage path must declare a non-empty displayName.`,
          );
        }
        if (!launchCommand) {
          errors.push(
            `${capabilityId} ink-authoring usage path must declare a non-empty launchCommand.`,
          );
        }
      }

      const resolvedUsagePath = resolveRepoPath(usageRefPath, context);
      if (!existsSync(resolvedUsagePath)) {
        errors.push(`${capabilityId} usage path not found: ${usageRefPath}`);
      }

      const requiredPermissions = ensureStringArray(
        usagePath.requiredPermissions ?? [],
        `capabilities[${capabilityId}].usagePaths[${usageIndex}].requiredPermissions`,
      );
      const undeclaredPermissions = requiredPermissions.filter(
        (permission) => !permissionGuidance.includes(permission),
      );
      if (usageType !== 'builtin-plugin' && undeclaredPermissions.length > 0) {
        errors.push(
          `${capabilityId} usage path permissions exceed permissionGuidance: ${undeclaredPermissions.join(', ')}`,
        );
      }

      const entrypoints = ensureStringArray(
        usagePath.entrypoints ?? [],
        `capabilities[${capabilityId}].usagePaths[${usageIndex}].entrypoints`,
      );
      const pluginPointIdsForUsage = ensureStringArray(
        usagePath.pluginPointIds ?? [],
        `capabilities[${capabilityId}].usagePaths[${usageIndex}].pluginPointIds`,
      );
      for (const pluginPointId of pluginPointIdsForUsage) {
        if (!pluginPointIds.has(pluginPointId)) {
          errors.push(
            `${capabilityId} usage path references unknown plugin point '${pluginPointId}'.`,
          );
        }
      }

      if (usageType === 'builtin-plugin') {
        const pluginId = typeof usagePath.pluginId === 'string' ? usagePath.pluginId.trim() : '';
        if (!pluginId) {
          errors.push(`${capabilityId} built-in usage path is missing pluginId.`);
          continue;
        }
        const catalogPlugin = (catalog.plugins ?? []).find((plugin) => plugin.id === pluginId);
        if (!catalogPlugin) {
          errors.push(`${capabilityId} built-in usage path references unknown plugin '${pluginId}'.`);
          continue;
        }

        const expectedPluginPath = path.join('plugins', catalogPlugin.pluginDir).replace(/\\/g, '/');
        const normalizedUsageRefPath = usageRefPath.replace(/\\/g, '/');
        const builtInPathValid = usageSurface === 'ink-authoring'
          ? normalizedUsageRefPath.startsWith(`${expectedPluginPath}/`)
          : normalizedUsageRefPath === expectedPluginPath;
        if (!builtInPathValid) {
          errors.push(
            `${pluginId} usage path must match catalog pluginDir (${expectedPluginPath}), received ${usageRefPath}.`,
          );
        }

        const matrixEntry = (sdkCapabilityMatrix.plugins ?? []).find((plugin) => plugin.id === pluginId);
        if (!matrixEntry) {
          errors.push(`${pluginId} built-in usage path is missing sdk-capability-matrix entry.`);
          continue;
        }
        if (!(matrixEntry.sdkCapabilities ?? []).includes(capabilityId)) {
          errors.push(`${pluginId} built-in usage path is missing capability '${capabilityId}' in sdk-capability-matrix.`);
        }
        const expectedPermissions = ensureStringArray(
          matrixEntry.expectedPermissions ?? [],
          `plugins[${pluginId}].expectedPermissions`,
        );
        if (usageSurface === 'ink-authoring') {
          const undeclaredPermissions = requiredPermissions.filter(
            (permission) => !expectedPermissions.includes(permission),
          );
          if (undeclaredPermissions.length > 0) {
            errors.push(`${pluginId} ink-authoring permissions exceed sdk-capability-matrix expectedPermissions.`);
          }
        } else if (!equalStringSets(requiredPermissions, expectedPermissions)) {
          errors.push(`${pluginId} usage path permissions drift from sdk-capability-matrix expectedPermissions.`);
        }
        if (entrypoints.length > 0 && !equalStringSets(entrypoints, ensureStringArray(
          matrixEntry.primaryEntrypoints ?? [],
          `plugins[${pluginId}].primaryEntrypoints`,
        ))) {
          errors.push(`${pluginId} usage path entrypoints drift from sdk-capability-matrix primaryEntrypoints.`);
        }
      }
    }
  }

  const missingCapabilities = officialCapabilities.filter((capability) => !seenCapabilityIds.has(capability));
  if (missingCapabilities.length > 0) {
    errors.push(
      `Missing sdk usage inventory entries for official capabilities: ${missingCapabilities.join(', ')}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(buildSdkUsageValidationError(errors));
  }
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

export function validateExtensionPointMatrixShape(matrix) {
  if (!matrix || typeof matrix !== 'object') {
    throw new Error('Plugin-point matrix must be an object.');
  }
  if (matrix.schemaVersion !== 1) {
    throw new Error(`Unsupported plugin-point matrix schemaVersion: ${matrix.schemaVersion}`);
  }
  const pluginPoints = Array.isArray(matrix.pluginPoints) ? matrix.pluginPoints : null;
  if (!pluginPoints || pluginPoints.length === 0) {
    throw new Error('Plugin-point matrix must contain non-empty pluginPoints[].');
  }

  const seen = new Set();
  for (const point of pluginPoints) {
    if (!point || typeof point !== 'object') {
      throw new Error('Plugin-point matrix pluginPoints[] entries must be objects.');
    }
    ensureRequiredString(point.id, 'id', '<plugin-point>');
    ensureRequiredString(point.kind, 'kind', point.id);
    if (seen.has(point.id)) {
      throw new Error(`Duplicate plugin-point id in matrix: ${point.id}`);
    }
    seen.add(point.id);
    const prerequisites = ensureStringArray(
      point.manifestPrerequisites ?? [],
      `pluginPoints[${point.id}].manifestPrerequisites`,
    );
    if (prerequisites.length === 0) {
      throw new Error(`pluginPoints[${point.id}].manifestPrerequisites must not be empty.`);
    }
    if (!point.sdkSupport || typeof point.sdkSupport !== 'object') {
      throw new Error(`pluginPoints[${point.id}].sdkSupport must be an object.`);
    }
    if (!point.scaffoldSupport || typeof point.scaffoldSupport !== 'object') {
      throw new Error(`pluginPoints[${point.id}].scaffoldSupport must be an object.`);
    }
    if (point.sdkSupport.rust !== true && point.sdkSupport.typescript !== true) {
      throw new Error(`pluginPoints[${point.id}] must support at least one official SDK.`);
    }
    if (point.scaffoldSupport.builtin !== true && point.scaffoldSupport.external !== true) {
      throw new Error(`pluginPoints[${point.id}] must support at least one scaffold profile.`);
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
  const isWindowsPnpm = process.platform === 'win32' && command === 'pnpm';
  const resolvedCommand = isWindowsPnpm ? (process.env.comspec ?? 'cmd.exe') : command;
  const resolvedArgs = isWindowsPnpm ? ['/d', '/s', '/c', command, ...args] : args;
  const quiet = options.quiet ?? false;
  const result = spawnSync(resolvedCommand, resolvedArgs, {
    cwd: options.cwd ?? REPO_ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    shell: false,
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
    const testCommand = buildTypeScriptPluginTestCommand(plugin);
    runCommand(testCommand.command, testCommand.args, {
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

export function buildTypeScriptPluginTestCommand(plugin) {
  return {
    command: 'pnpm',
    args: ['exec', 'jest', '--runInBand', plugin.testFile],
  };
}

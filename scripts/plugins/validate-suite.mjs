import {
  buildPlugin,
  createFailureSummary,
  createRunSummary,
  ensureFileExists,
  formatMetadataDrift,
  getOfficialSdkCapabilityFamilies,
  parseMaintainerArgs,
  printRunSummary,
  readCatalog,
  readExtensionPointMatrix,
  readSdkCapabilityMatrix,
  readSdkUsageInventory,
  recordRunFailure,
  recordRunSuccess,
  resolveArtifactPath,
  resolvePluginRoot,
  resolveSelectedPlugins,
  runPluginTests,
  sha256File,
  validateCatalogShape,
  validateExtensionPointMatrixShape,
  validatePluginCapabilityMatrixEntry,
  validateSdkCapabilityMatrixShape,
  validateSdkUsageInventoryShape,
  validatePluginProjectMetadata,
} from './lib.mjs';
import { readFileSync } from 'node:fs';

function validateLocalizedPluginEvidence(plugin, pluginRoot) {
  ensureFileExists(`${pluginRoot}/README.md`, `README.md for ${plugin.id}`);
  const manifestRaw = readFileSync(`${pluginRoot}/plugin.toml`, 'utf8');

  for (const marker of ['name_zh =', 'description_zh =', '[locales.en]', '[locales.zh]']) {
    if (!manifestRaw.includes(marker)) {
      throw new Error(`Manifest for ${plugin.id} is missing localized evidence marker: ${marker}`);
    }
  }
}

const command = 'validate';
let parsedArgs = {
  pluginIds: [],
  frameworks: [],
  json: false,
  filtered: false,
  skipBuild: false,
  skipTests: false,
};
let catalog;
let summary;
let sdkCapabilityMatrix;
let extensionPointMatrix;
let sdkUsageInventory;

try {
  parsedArgs = parseMaintainerArgs(process.argv.slice(2), {
    allowSkipBuild: true,
    allowSkipTests: true,
  });
  catalog = readCatalog();
  validateCatalogShape(catalog);
  extensionPointMatrix = readExtensionPointMatrix();
  validateExtensionPointMatrixShape(extensionPointMatrix);
  sdkCapabilityMatrix = readSdkCapabilityMatrix();
  validateSdkCapabilityMatrixShape(sdkCapabilityMatrix, catalog);
  sdkUsageInventory = readSdkUsageInventory();
  validateSdkUsageInventoryShape(sdkUsageInventory, {
    officialCapabilities: getOfficialSdkCapabilityFamilies(),
    catalog,
    sdkCapabilityMatrix,
    extensionPointMatrix,
  });

  const selection = resolveSelectedPlugins(catalog, parsedArgs);
  summary = createRunSummary(command, selection, { json: parsedArgs.json });

  for (const plugin of selection.selected) {
    try {
      if (!parsedArgs.json) {
        console.log(`[builtins][validate] ${plugin.id}`);
      }

      const pluginRoot = resolvePluginRoot(plugin);
      ensureFileExists(pluginRoot, `Plugin directory for ${plugin.id}`);
      ensureFileExists(`${pluginRoot}/plugin.toml`, `plugin.toml for ${plugin.id}`);
      validateLocalizedPluginEvidence(plugin, pluginRoot);

      const metadataDrift = validatePluginProjectMetadata(plugin);
      if (metadataDrift.length > 0) {
        throw new Error(formatMetadataDrift(plugin, metadataDrift).join('\n'));
      }

      const capabilityDrift = validatePluginCapabilityMatrixEntry(plugin, sdkCapabilityMatrix);
      if (capabilityDrift.length > 0) {
        throw new Error(capabilityDrift.join('\n'));
      }

      if (!parsedArgs.skipBuild) {
        await buildPlugin(plugin, { quiet: parsedArgs.json });
      }

      const artifactPath = resolveArtifactPath(plugin);
      ensureFileExists(artifactPath, `plugin artifact for ${plugin.id}`);
      const actualChecksum = sha256File(artifactPath);
      if (actualChecksum !== plugin.checksumSha256) {
        throw new Error(
          `Checksum mismatch for ${plugin.id}. expected=${plugin.checksumSha256} actual=${actualChecksum}. Run pnpm plugins:checksums.`,
        );
      }

      if (!parsedArgs.skipTests) {
        runPluginTests(plugin, { quiet: parsedArgs.json });
      }

      if (!parsedArgs.json) {
        console.log(`[builtins][validate] ok ${plugin.id}`);
      }

      recordRunSuccess(summary, plugin, { framework: plugin.framework });
    } catch (error) {
      recordRunFailure(summary, plugin, error, { framework: plugin.framework });

      if (!parsedArgs.json) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[builtins][validate] failed ${plugin.id}: ${message}`);
      }
    }
  }
} catch (error) {
  summary = createFailureSummary(command, parsedArgs, catalog, error);
}

const finalized = printRunSummary(summary, { json: parsedArgs.json });

if (finalized.failures.length > 0) {
  process.exit(1);
}

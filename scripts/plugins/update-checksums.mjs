import {
  createFailureSummary,
  createRunSummary,
  ensureFileExists,
  parseMaintainerArgs,
  printRunSummary,
  readCatalog,
  recordRunFailure,
  recordRunSuccess,
  resolveArtifactPath,
  resolveSelectedPlugins,
  sha256File,
  validateCatalogShape,
  writeCatalog,
} from './lib.mjs';

const command = 'checksums';
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

try {
  parsedArgs = parseMaintainerArgs(process.argv.slice(2));
  catalog = readCatalog();
  validateCatalogShape(catalog);

  const selection = resolveSelectedPlugins(catalog, parsedArgs);
  summary = createRunSummary(command, selection, { json: parsedArgs.json });
  const updatedChecksums = new Map();

  for (const plugin of selection.selected) {
    try {
      const artifactPath = resolveArtifactPath(plugin);
      ensureFileExists(artifactPath, `Artifact for ${plugin.id}`);
      const checksumSha256 = sha256File(artifactPath);
      updatedChecksums.set(plugin.id, checksumSha256);

      if (!parsedArgs.json) {
        console.log(`[builtins][checksum] ${plugin.id} ${checksumSha256}`);
      }

      recordRunSuccess(summary, plugin, { checksumSha256 });
    } catch (error) {
      recordRunFailure(summary, plugin, error);
    }
  }

  if (summary.failures.length === 0) {
    for (const plugin of catalog.plugins) {
      const checksumSha256 = updatedChecksums.get(plugin.id);
      if (checksumSha256) {
        plugin.checksumSha256 = checksumSha256;
      }
    }
    catalog.generatedAt = new Date().toISOString();
    writeCatalog(catalog);
  }
} catch (error) {
  summary = createFailureSummary(command, parsedArgs, catalog, error);
}

const finalized = printRunSummary(summary, { json: parsedArgs.json });

if (finalized.failures.length > 0) {
  process.exit(1);
}

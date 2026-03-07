import {
  buildPlugin,
  createFailureSummary,
  createRunSummary,
  finalizeRunSummary,
  parseMaintainerArgs,
  printRunSummary,
  readCatalog,
  recordRunFailure,
  recordRunSuccess,
  resolveSelectedPlugins,
  validateCatalogShape,
} from './lib.mjs';

const command = 'build';
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

  for (const plugin of selection.selected) {
    if (!parsedArgs.json) {
      console.log(`[builtins][build] ${plugin.id} (${plugin.framework})`);
    }

    try {
      await buildPlugin(plugin, { quiet: parsedArgs.json });
      recordRunSuccess(summary, plugin, { framework: plugin.framework });
    } catch (error) {
      recordRunFailure(summary, plugin, error, { framework: plugin.framework });
    }
  }
} catch (error) {
  summary = createFailureSummary(command, parsedArgs, catalog, error);
}

const finalized = printRunSummary(summary ?? finalizeRunSummary(summary), { json: parsedArgs.json });

if (finalized.failures.length > 0) {
  process.exit(1);
}

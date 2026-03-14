import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(__filename);
const repoRoot = path.resolve(moduleDir, '..', '..');

const defaultPathConfig = {
  commands: path.join(repoRoot, 'src-tauri', 'src', 'commands', 'git.rs'),
  wrappers: path.join(repoRoot, 'lib', 'tauri.ts'),
  hookSources: [
    {
      path: path.join(repoRoot, 'hooks', 'use-git.ts'),
      interfaceName: 'UseGitReturn',
    },
    {
      path: path.join(repoRoot, 'hooks', 'use-git-advanced.ts'),
      interfaceName: 'UseGitAdvancedReturn',
    },
    {
      path: path.join(repoRoot, 'hooks', 'use-git-lfs.ts'),
      interfaceName: 'UseGitLfsReturn',
    },
  ],
  matrixEn: path.join(repoRoot, 'docs', 'en', 'development', 'git-integration-matrix.md'),
  matrixZh: path.join(repoRoot, 'docs', 'zh', 'development', 'git-integration-matrix.md'),
};

const commandDeclarationPattern =
  /#\s*\[tauri::command\][\s\S]*?pub\s+(?:async\s+)?fn\s+(git_[a-z0-9_]+)\s*\(/g;
const exportConstPattern = /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
const invokeGitPattern = /invoke(?:<[^>]+>)?\(\s*["'](git_[a-z0-9_]+)["']/;
const functionPropPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\??:\s*([\s\S]*?);/gm;
const backtickPattern = /`([^`]+)`/g;

function toSet(values) {
  return new Set(values);
}

function diffSets(left, right) {
  const missing = [];
  for (const value of left) {
    if (!right.has(value)) {
      missing.push(value);
    }
  }
  return missing.sort();
}

function sortUnique(values) {
  return [...new Set(values)].sort();
}

export function extractGitCommands(source) {
  const commands = [];
  for (const match of source.matchAll(commandDeclarationPattern)) {
    commands.push(match[1]);
  }
  return sortUnique(commands);
}

export function extractGitWrapperMappings(source) {
  const wrappers = new Set();
  const commandToWrappers = new Map();

  const exports = [...source.matchAll(exportConstPattern)];
  for (let index = 0; index < exports.length; index += 1) {
    const current = exports[index];
    const next = exports[index + 1];
    const wrapper = current[1];
    const chunkStart = current.index;
    const chunkEnd = next ? next.index : source.length;
    const chunk = source.slice(chunkStart, chunkEnd);

    const commandMatch = chunk.match(invokeGitPattern);
    if (!commandMatch) {
      continue;
    }
    const command = commandMatch[1];

    wrappers.add(wrapper);
    if (!commandToWrappers.has(command)) {
      commandToWrappers.set(command, new Set());
    }
    commandToWrappers.get(command).add(wrapper);
  }

  return {
    wrappers: sortUnique([...wrappers]),
    commandToWrappers,
  };
}

function extractInterfaceBody(source, interfaceName) {
  const marker = `export interface ${interfaceName}`;
  const interfaceIndex = source.indexOf(marker);
  if (interfaceIndex === -1) {
    throw new Error(`Unable to locate interface ${interfaceName}.`);
  }

  const bodyStart = source.indexOf('{', interfaceIndex);
  if (bodyStart === -1) {
    throw new Error(`Unable to locate interface body for ${interfaceName}.`);
  }

  let depth = 0;
  for (let cursor = bodyStart; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, cursor);
      }
    }
  }

  throw new Error(`Unterminated interface body for ${interfaceName}.`);
}

export function extractHookApiNames(source, interfaceName) {
  const body = extractInterfaceBody(source, interfaceName);
  const names = [];

  for (const match of body.matchAll(functionPropPattern)) {
    const propName = match[1];
    const propType = match[2];
    if (propType.includes('=>')) {
      names.push(propName);
    }
  }

  return sortUnique(names);
}

function extractBacktickTokens(cell) {
  const symbols = [];
  for (const match of cell.matchAll(backtickPattern)) {
    const token = match[1].trim();
    if (token) {
      symbols.push(token);
    }
  }
  return symbols;
}

function normalizeHookSymbol(symbol) {
  const trimmed = symbol.trim();
  if (!trimmed) return null;

  const withoutCall = trimmed.endsWith('()')
    ? trimmed.slice(0, -2)
    : trimmed;
  if (!withoutCall.includes('.')) {
    return withoutCall;
  }
  const parts = withoutCall.split('.');
  return parts[parts.length - 1] ?? null;
}

export function parseMatrixSymbols(markdown) {
  const commands = new Set();
  const wrappers = new Set();
  const hooks = new Set();
  const rows = [];

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      continue;
    }
    if (/^\|\s*-+/.test(trimmed)) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) {
      continue;
    }
    if (cells[0].includes('Rust Command') || cells[0].includes('Rust 命令')) {
      continue;
    }

    const commandTokens = extractBacktickTokens(cells[0]);
    const wrapperTokens = extractBacktickTokens(cells[1]);
    const hookTokens = extractBacktickTokens(cells[2])
      .map(normalizeHookSymbol)
      .filter(Boolean);

    if (
      commandTokens.length === 0 &&
      wrapperTokens.length === 0 &&
      hookTokens.length === 0
    ) {
      continue;
    }

    for (const token of commandTokens) {
      commands.add(token);
    }
    for (const token of wrapperTokens) {
      wrappers.add(token);
    }
    for (const token of hookTokens) {
      hooks.add(token);
    }

    rows.push({
      commands: commandTokens,
      wrappers: wrapperTokens,
      hooks: hookTokens,
    });
  }

  return {
    commands,
    wrappers,
    hooks,
    rows,
  };
}

function addMissingCoverageIssues(output, symbols, documented, scope, language, filePath) {
  const missing = diffSets(toSet(symbols), documented);
  for (const symbol of missing) {
    output.push(
      `${language} matrix missing ${scope} symbol \`${symbol}\` (${path.relative(repoRoot, filePath).replace(/\\/g, '/')})`,
    );
  }
}

function addUnknownMatrixIssues(output, documented, declared, scope, language, filePath) {
  const stale = diffSets(documented, declared);
  for (const symbol of stale) {
    output.push(
      `${language} matrix references unknown ${scope} symbol \`${symbol}\` (${path.relative(repoRoot, filePath).replace(/\\/g, '/')})`,
    );
  }
}

function addLanguageParityIssues(output, scope, enSet, zhSet) {
  const missingInZh = diffSets(enSet, zhSet);
  for (const symbol of missingInZh) {
    output.push(`ZH matrix is missing ${scope} symbol \`${symbol}\` that exists in EN matrix.`);
  }

  const missingInEn = diffSets(zhSet, enSet);
  for (const symbol of missingInEn) {
    output.push(`EN matrix is missing ${scope} symbol \`${symbol}\` that exists in ZH matrix.`);
  }
}

export function validateGitIntegrationSources(sourceConfig) {
  const {
    commandSource,
    wrapperSource,
    hookSources,
    matrixEnSource,
    matrixZhSource,
  } = sourceConfig;

  const commandSymbols = extractGitCommands(commandSource);
  const wrapperMappings = extractGitWrapperMappings(wrapperSource);
  const wrapperSymbols = wrapperMappings.wrappers;
  const hookSymbols = sortUnique(
    hookSources.flatMap((source) =>
      extractHookApiNames(source.content, source.interfaceName),
    ),
  );

  const matrixEn = parseMatrixSymbols(matrixEnSource);
  const matrixZh = parseMatrixSymbols(matrixZhSource);

  const errors = [];

  for (const command of commandSymbols) {
    if (!wrapperMappings.commandToWrappers.has(command)) {
      errors.push(
        `Backend command \`${command}\` has no wrapper in lib/tauri.ts.`,
      );
    }
  }

  addMissingCoverageIssues(
    errors,
    commandSymbols,
    matrixEn.commands,
    'command',
    'EN',
    defaultPathConfig.matrixEn,
  );
  addMissingCoverageIssues(
    errors,
    commandSymbols,
    matrixZh.commands,
    'command',
    'ZH',
    defaultPathConfig.matrixZh,
  );

  addMissingCoverageIssues(
    errors,
    wrapperSymbols,
    matrixEn.wrappers,
    'wrapper',
    'EN',
    defaultPathConfig.matrixEn,
  );
  addMissingCoverageIssues(
    errors,
    wrapperSymbols,
    matrixZh.wrappers,
    'wrapper',
    'ZH',
    defaultPathConfig.matrixZh,
  );

  addUnknownMatrixIssues(
    errors,
    matrixEn.commands,
    toSet(commandSymbols),
    'command',
    'EN',
    defaultPathConfig.matrixEn,
  );
  addUnknownMatrixIssues(
    errors,
    matrixZh.commands,
    toSet(commandSymbols),
    'command',
    'ZH',
    defaultPathConfig.matrixZh,
  );

  addUnknownMatrixIssues(
    errors,
    matrixEn.wrappers,
    toSet(wrapperSymbols),
    'wrapper',
    'EN',
    defaultPathConfig.matrixEn,
  );
  addUnknownMatrixIssues(
    errors,
    matrixZh.wrappers,
    toSet(wrapperSymbols),
    'wrapper',
    'ZH',
    defaultPathConfig.matrixZh,
  );

  addUnknownMatrixIssues(
    errors,
    matrixEn.hooks,
    toSet(hookSymbols),
    'hook API',
    'EN',
    defaultPathConfig.matrixEn,
  );
  addUnknownMatrixIssues(
    errors,
    matrixZh.hooks,
    toSet(hookSymbols),
    'hook API',
    'ZH',
    defaultPathConfig.matrixZh,
  );

  addLanguageParityIssues(errors, 'command', matrixEn.commands, matrixZh.commands);
  addLanguageParityIssues(errors, 'wrapper', matrixEn.wrappers, matrixZh.wrappers);
  addLanguageParityIssues(errors, 'hook API', matrixEn.hooks, matrixZh.hooks);

  return {
    errors,
    summary: {
      commandCount: commandSymbols.length,
      wrapperCount: wrapperSymbols.length,
      hookApiCount: hookSymbols.length,
      enRows: matrixEn.rows.length,
      zhRows: matrixZh.rows.length,
    },
  };
}

export function loadDefaultSources(pathConfig = {}) {
  const config = {
    ...defaultPathConfig,
    ...pathConfig,
    hookSources: pathConfig.hookSources ?? defaultPathConfig.hookSources,
  };

  const hookSources = config.hookSources.map((hookSource) => ({
    interfaceName: hookSource.interfaceName,
    content: readFileSync(hookSource.path, 'utf8'),
  }));

  return {
    commandSource: readFileSync(config.commands, 'utf8'),
    wrapperSource: readFileSync(config.wrappers, 'utf8'),
    hookSources,
    matrixEnSource: readFileSync(config.matrixEn, 'utf8'),
    matrixZhSource: readFileSync(config.matrixZh, 'utf8'),
  };
}

export function validateGitIntegration(pathConfig = {}) {
  return validateGitIntegrationSources(loadDefaultSources(pathConfig));
}

export function runCli(pathConfig = {}) {
  const result = validateGitIntegration(pathConfig);
  if (result.errors.length === 0) {
    console.log(
      `[git:validate] Passed (${result.summary.commandCount} commands, ${result.summary.wrapperCount} wrappers, ${result.summary.hookApiCount} hook APIs).`,
    );
    return 0;
  }

  for (const error of result.errors) {
    console.error(`[git:validate] ${error}`);
  }
  console.error(`[git:validate] Found ${result.errors.length} issue(s).`);
  return 1;
}

function isDirectExecution() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  process.exit(runCli());
}

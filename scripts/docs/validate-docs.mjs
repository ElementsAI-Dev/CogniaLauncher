import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const docsRoot = path.join(repoRoot, 'docs');
const docsEnRoot = path.join(docsRoot, 'en');
const docsZhRoot = path.join(docsRoot, 'zh');
const packageJsonPath = path.join(repoRoot, 'package.json');
const coverageMatrixPath = path.join(docsRoot, 'documentation-coverage-matrix.json');

const args = process.argv.slice(2);
const mode = parseMode(args);
const enforce = mode === 'enforce';

const requiredCorePages = [
  'index.md',
  'getting-started/index.md',
  'guide/index.md',
  'development/index.md',
  'architecture/index.md',
  'reference/index.md',
  'design/index.md',
  'appendix/index.md',
];

const shellFenceLanguages = new Set([
  'bash',
  'sh',
  'shell',
  'zsh',
  'pwsh',
  'powershell',
]);

const unsupportedPackageManagers = new Set(['npm', 'yarn', 'bun']);
const allowedPnpmSubcommands = new Set([
  'add',
  'audit',
  'create',
  'dlx',
  'exec',
  'fetch',
  'help',
  'import',
  'info',
  'install',
  'link',
  'list',
  'outdated',
  'pack',
  'patch',
  'patch-commit',
  'publish',
  'remove',
  'root',
  'setup',
  'store',
  'tauri',
  'unlink',
  'update',
  'up',
  'why',
]);

const packageScripts = loadPackageScripts();
const docsFiles = collectMarkdownFiles(docsRoot);
const headingCache = buildHeadingCache(docsFiles);
const issues = [];
const coverageContext = buildCoverageContext(loadCoverageMatrix(issues), issues);

validateCoreParity(issues);
for (const filePath of docsFiles) {
  validateLinks(filePath, headingCache, issues, coverageContext.capabilityIdsByDocPath);
  validateCommandExamples(
    filePath,
    packageScripts,
    issues,
    coverageContext.operationalDocPaths,
    coverageContext.capabilityIdsByDocPath,
  );
}

if (issues.length === 0) {
  console.log('[docs:validate] All checks passed (parity, links, commands).');
  process.exit(0);
}

for (const issue of issues) {
  const relFilePath = path.relative(repoRoot, issue.file).replace(/\\/g, '/');
  const capabilityContext =
    issue.capabilityIds && issue.capabilityIds.length > 0
      ? ` [capabilities: ${issue.capabilityIds.join(', ')}]`
      : '';
  console.error(`[${issue.type}] ${relFilePath}${capabilityContext}: ${issue.message}`);
}

const suffix = enforce
  ? '[docs:validate] Failing because validation mode is enforce.'
  : '[docs:validate] Warning mode enabled; not failing the process.';
console.error(`[docs:validate] Found ${issues.length} issue(s).`);
console.error(suffix);

if (enforce) {
  process.exit(1);
}

process.exit(0);

function parseMode(values) {
  const modeArg = values.find((value) => value.startsWith('--mode='));
  const rawMode = modeArg?.slice('--mode='.length) ?? 'enforce';
  if (rawMode !== 'enforce' && rawMode !== 'warn') {
    throw new Error(`Unsupported docs validation mode: ${rawMode}`);
  }
  return rawMode;
}

function loadCoverageMatrix(outputIssues) {
  if (!fileExists(coverageMatrixPath)) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      message: 'Missing documentation coverage matrix at "docs/documentation-coverage-matrix.json".',
    });
    return null;
  }

  try {
    return JSON.parse(readFileSync(coverageMatrixPath, 'utf8'));
  } catch (error) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      message: `Failed to parse documentation coverage matrix JSON: ${error.message}`,
    });
    return null;
  }
}

function buildCoverageContext(rawCoverageMatrix, outputIssues) {
  const context = {
    capabilityIdsByDocPath: new Map(),
    operationalDocPaths: new Set(),
  };

  if (!rawCoverageMatrix || typeof rawCoverageMatrix !== 'object') {
    return context;
  }

  const requiredCapabilities = rawCoverageMatrix.requiredCapabilities;
  const capabilityMappings = rawCoverageMatrix.capabilities;

  if (!Array.isArray(requiredCapabilities)) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      message: 'Coverage matrix field "requiredCapabilities" must be an array.',
    });
  }

  if (!Array.isArray(capabilityMappings)) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      message: 'Coverage matrix field "capabilities" must be an array.',
    });
    return context;
  }

  const capabilityIds = new Set();

  for (let index = 0; index < capabilityMappings.length; index += 1) {
    const rawMapping = capabilityMappings[index];
    const mapping = normalizeCoverageMapping(rawMapping, index + 1, outputIssues);
    if (!mapping) {
      continue;
    }

    if (capabilityIds.has(mapping.id)) {
      outputIssues.push({
        type: 'coverage',
        file: coverageMatrixPath,
        capabilityIds: [mapping.id],
        message: `Duplicate capability mapping id "${mapping.id}".`,
      });
      continue;
    }

    capabilityIds.add(mapping.id);
    registerCoveragePaths(mapping, context, outputIssues);
  }

  if (Array.isArray(requiredCapabilities)) {
    for (let index = 0; index < requiredCapabilities.length; index += 1) {
      const rawRequiredId = requiredCapabilities[index];
      if (typeof rawRequiredId !== 'string' || !rawRequiredId.trim()) {
        outputIssues.push({
          type: 'coverage',
          file: coverageMatrixPath,
          message: `requiredCapabilities[${index}] must be a non-empty string.`,
        });
        continue;
      }

      const requiredId = rawRequiredId.trim();
      if (!capabilityIds.has(requiredId)) {
        outputIssues.push({
          type: 'coverage',
          file: coverageMatrixPath,
          capabilityIds: [requiredId],
          message: `Required capability "${requiredId}" does not have a matching entry in "capabilities".`,
        });
      }
    }
  }

  return context;
}

function normalizeCoverageMapping(rawMapping, rowNumber, outputIssues) {
  if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      message: `capabilities[${rowNumber - 1}] must be an object.`,
    });
    return null;
  }

  const id = typeof rawMapping.id === 'string' ? rawMapping.id.trim() : '';
  const owner = typeof rawMapping.owner === 'string' ? rawMapping.owner.trim() : '';
  const enPages = normalizeCoveragePageList(rawMapping.enPages, rowNumber, 'enPages', 'docs/en/', outputIssues);
  const zhPages = normalizeCoveragePageList(rawMapping.zhPages, rowNumber, 'zhPages', 'docs/zh/', outputIssues);

  if (rawMapping.operational !== undefined && typeof rawMapping.operational !== 'boolean') {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      capabilityIds: id ? [id] : undefined,
      message: `capabilities[${rowNumber - 1}].operational must be a boolean when provided.`,
    });
  }

  if (!id) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      message: `capabilities[${rowNumber - 1}] is missing required field "id".`,
    });
    return null;
  }

  if (!owner) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      capabilityIds: [id],
      message: `Capability "${id}" is missing required field "owner".`,
    });
    return null;
  }

  if (enPages.length === 0 || zhPages.length === 0) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      capabilityIds: [id],
      message: `Capability "${id}" must include at least one valid path in both "enPages" and "zhPages".`,
    });
    return null;
  }

  return {
    id,
    owner,
    operational: rawMapping.operational === true,
    enPages,
    zhPages,
  };
}

function normalizeCoveragePageList(rawPages, rowNumber, fieldName, requiredPrefix, outputIssues) {
  if (!Array.isArray(rawPages)) {
    outputIssues.push({
      type: 'coverage',
      file: coverageMatrixPath,
      message: `capabilities[${rowNumber - 1}].${fieldName} must be an array.`,
    });
    return [];
  }

  const normalizedPages = [];

  for (let pageIndex = 0; pageIndex < rawPages.length; pageIndex += 1) {
    const rawPage = rawPages[pageIndex];
    if (typeof rawPage !== 'string' || !rawPage.trim()) {
      outputIssues.push({
        type: 'coverage',
        file: coverageMatrixPath,
        message: `capabilities[${rowNumber - 1}].${fieldName}[${pageIndex}] must be a non-empty string.`,
      });
      continue;
    }

    const normalizedPath = normalizeRepoRelativePath(rawPage);
    if (!normalizedPath.startsWith(requiredPrefix)) {
      outputIssues.push({
        type: 'coverage',
        file: coverageMatrixPath,
        message: `capabilities[${rowNumber - 1}].${fieldName}[${pageIndex}] must start with "${requiredPrefix}".`,
      });
      continue;
    }
    if (path.extname(normalizedPath) !== '.md') {
      outputIssues.push({
        type: 'coverage',
        file: coverageMatrixPath,
        message: `capabilities[${rowNumber - 1}].${fieldName}[${pageIndex}] must reference a Markdown file.`,
      });
      continue;
    }

    normalizedPages.push(normalizedPath);
  }

  return [...new Set(normalizedPages)];
}

function registerCoveragePaths(mapping, context, outputIssues) {
  const allPages = [...mapping.enPages, ...mapping.zhPages];

  for (const relativePath of allPages) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const normalizedAbsolutePath = normalizeFsPath(absolutePath);
    if (!fileExists(absolutePath)) {
      outputIssues.push({
        type: 'coverage',
        file: coverageMatrixPath,
        capabilityIds: [mapping.id],
        message: `Capability "${mapping.id}" references missing docs path "${relativePath}".`,
      });
      continue;
    }

    const existingIds = context.capabilityIdsByDocPath.get(normalizedAbsolutePath) ?? new Set();
    existingIds.add(mapping.id);
    context.capabilityIdsByDocPath.set(normalizedAbsolutePath, existingIds);

    if (mapping.operational) {
      context.operationalDocPaths.add(normalizedAbsolutePath);
    }
  }
}

function normalizeRepoRelativePath(value) {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function normalizeFsPath(value) {
  return path.normalize(value).toLowerCase();
}

function loadPackageScripts() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return new Set(Object.keys(packageJson.scripts ?? {}));
}

function collectMarkdownFiles(rootDir) {
  const files = [];
  walkDirectory(rootDir, files);
  return files;
}

function walkDirectory(currentDir, files) {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
}

function buildHeadingCache(files) {
  const cache = new Map();
  for (const filePath of files) {
    const fileContent = readFileSync(filePath, 'utf8');
    cache.set(filePath, collectAnchors(fileContent));
  }
  return cache;
}

function collectAnchors(fileContent) {
  const anchors = new Set();
  const slugger = new GithubSlugger();
  let inFence = false;

  for (const line of fileContent.split(/\r?\n/)) {
    if (isFenceBoundary(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (!headingMatch) {
      continue;
    }
    const normalizedHeading = normalizeHeadingText(headingMatch[1]);
    if (!normalizedHeading) {
      continue;
    }
    anchors.add(slugger.slug(normalizedHeading));
  }

  return anchors;
}

function normalizeHeadingText(value) {
  return value
    .replace(/\s+#+\s*$/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}

function validateCoreParity(outputIssues) {
  for (const relativePath of requiredCorePages) {
    const enPath = path.join(docsEnRoot, relativePath);
    const zhPath = path.join(docsZhRoot, relativePath);
    const hasEn = fileExists(enPath);
    const hasZh = fileExists(zhPath);

    if (hasEn && hasZh) {
      continue;
    }

    if (!hasEn) {
      outputIssues.push({
        type: 'parity',
        file: enPath,
        message: `Missing required English core page for "${relativePath}".`,
      });
    }
    if (!hasZh) {
      outputIssues.push({
        type: 'parity',
        file: zhPath,
        message: `Missing required Chinese core page for "${relativePath}".`,
      });
    }
  }
}

function validateLinks(filePath, headingsByFile, outputIssues, capabilityIdsByDocPath) {
  const fileContent = readFileSync(filePath, 'utf8');
  const capabilityIds = getCapabilityIdsForFile(filePath, capabilityIdsByDocPath);
  let inFence = false;
  let lineNumber = 0;

  for (const line of fileContent.split(/\r?\n/)) {
    lineNumber += 1;

    if (isFenceBoundary(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    for (const rawTarget of extractMarkdownTargets(line)) {
      const target = stripLinkTitle(rawTarget);
      if (!shouldValidateTarget(target)) {
        continue;
      }

      if (target.startsWith('#')) {
        const anchor = sanitizeAnchor(target.slice(1));
        const ownAnchors = headingsByFile.get(filePath) ?? new Set();
        if (!ownAnchors.has(anchor)) {
          outputIssues.push({
            type: 'link',
            file: filePath,
            capabilityIds,
            message: `Line ${lineNumber}: Missing local anchor "#${anchor}".`,
          });
        }
        continue;
      }

      const { targetPath, anchor } = splitTarget(target);
      const resolvedPath = resolveRelativeDocPath(filePath, targetPath);
      if (!resolvedPath) {
        outputIssues.push({
          type: 'link',
          file: filePath,
          capabilityIds,
          message: `Line ${lineNumber}: Linked file does not exist: "${targetPath}".`,
        });
        continue;
      }

      if (!anchor || path.extname(resolvedPath) !== '.md') {
        continue;
      }

      const targetAnchors = headingsByFile.get(resolvedPath) ?? collectAnchors(readFileSync(resolvedPath, 'utf8'));
      const normalizedAnchor = sanitizeAnchor(anchor);
      if (!targetAnchors.has(normalizedAnchor)) {
        outputIssues.push({
          type: 'link',
          file: filePath,
          capabilityIds,
          message: `Line ${lineNumber}: Missing anchor "#${normalizedAnchor}" in "${toRepoRelative(resolvedPath)}".`,
        });
      }
    }
  }
}

function validateCommandExamples(
  filePath,
  scripts,
  outputIssues,
  operationalDocPaths,
  capabilityIdsByDocPath,
) {
  if (!shouldValidateCommandExamples(filePath, operationalDocPaths)) {
    return;
  }

  const fileContent = readFileSync(filePath, 'utf8');
  const capabilityIds = getCapabilityIdsForFile(filePath, capabilityIdsByDocPath);
  const lines = fileContent.split(/\r?\n/);
  let inFence = false;
  let fenceLanguage = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceLanguage = (fenceMatch[1] ?? '').toLowerCase();
      } else {
        inFence = false;
        fenceLanguage = '';
      }
      continue;
    }

    if (!inFence || !shellFenceLanguages.has(fenceLanguage)) {
      continue;
    }

    const commandLine = line.trim();
    if (!commandLine || commandLine.startsWith('#')) {
      continue;
    }

    for (const statement of splitShellStatements(commandLine)) {
      validateCommandStatement(filePath, index + 1, statement, scripts, outputIssues, capabilityIds);
    }
  }
}

function validateCommandStatement(filePath, lineNumber, statement, scripts, outputIssues, capabilityIds) {
  const normalizedStatement = statement
    .trim()
    .replace(/^\$\s*/, '')
    .replace(/^>\s*/, '');

  if (!normalizedStatement) {
    return;
  }

  const tokens = normalizedStatement.split(/\s+/);
  const [tool] = tokens;
  if (!tool) {
    return;
  }

  if (unsupportedPackageManagers.has(tool)) {
    outputIssues.push({
      type: 'command',
      file: filePath,
      capabilityIds,
      message: `Line ${lineNumber}: Unsupported package manager "${tool}" in workflow docs.`,
    });
    return;
  }

  if (tool !== 'pnpm') {
    return;
  }

  const subcommand = tokens[1];
  if (!subcommand || subcommand.startsWith('-')) {
    return;
  }

  if (subcommand === 'run') {
    const scriptName = tokens[2];
    if (!scriptName || scripts.has(scriptName)) {
      return;
    }
    outputIssues.push({
      type: 'command',
      file: filePath,
      capabilityIds,
      message: `Line ${lineNumber}: Unknown pnpm script "${scriptName}" in command "${normalizedStatement}".`,
    });
    return;
  }

  if (allowedPnpmSubcommands.has(subcommand) || scripts.has(subcommand)) {
    return;
  }

  outputIssues.push({
    type: 'command',
    file: filePath,
    capabilityIds,
    message: `Line ${lineNumber}: Unknown pnpm command/script "${subcommand}" in "${normalizedStatement}".`,
  });
}

function shouldValidateCommandExamples(filePath, operationalDocPaths) {
  if (operationalDocPaths.has(normalizeFsPath(filePath))) {
    return true;
  }
  return isWorkflowDoc(filePath);
}

function isWorkflowDoc(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/docs/en/getting-started/') ||
    normalized.includes('/docs/en/development/') ||
    normalized.includes('/docs/zh/getting-started/') ||
    normalized.includes('/docs/zh/development/')
  );
}

function getCapabilityIdsForFile(filePath, capabilityIdsByDocPath) {
  const capabilityIds = capabilityIdsByDocPath.get(normalizeFsPath(filePath));
  if (!capabilityIds) {
    return undefined;
  }
  return Array.from(capabilityIds).sort();
}

function splitShellStatements(line) {
  return line
    .split('&&')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function shouldValidateTarget(target) {
  if (!target) {
    return false;
  }

  const lowerTarget = target.toLowerCase();
  const prefixes = ['http://', 'https://', 'mailto:', 'tel:', 'data:', 'javascript:'];
  if (prefixes.some((prefix) => lowerTarget.startsWith(prefix))) {
    return false;
  }

  return true;
}

function extractMarkdownTargets(line) {
  const targets = [];
  const pattern = /(?<!!)\[[^\]]*]\(([^)]+)\)/g;
  let match = pattern.exec(line);
  while (match) {
    targets.push(match[1]);
    match = pattern.exec(line);
  }
  return targets;
}

function stripLinkTitle(target) {
  let trimmed = target.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  const whitespaceIndex = trimmed.search(/\s/);
  const withoutTitle = whitespaceIndex >= 0 ? trimmed.slice(0, whitespaceIndex) : trimmed;
  return safeDecodeUri(withoutTitle);
}

function splitTarget(target) {
  const hashIndex = target.indexOf('#');
  if (hashIndex < 0) {
    return { targetPath: target, anchor: '' };
  }
  return {
    targetPath: target.slice(0, hashIndex),
    anchor: target.slice(hashIndex + 1),
  };
}

function resolveRelativeDocPath(fromFilePath, rawTargetPath) {
  if (!rawTargetPath) {
    return fromFilePath;
  }

  let candidate;
  if (rawTargetPath.startsWith('/')) {
    candidate = path.join(docsRoot, rawTargetPath.replace(/^\/+/, ''));
  } else {
    candidate = path.resolve(path.dirname(fromFilePath), rawTargetPath);
  }

  const resolvedCandidates = [];
  if (fileExists(candidate)) {
    resolvedCandidates.push(candidate);
  }
  if (!path.extname(candidate)) {
    resolvedCandidates.push(`${candidate}.md`);
    resolvedCandidates.push(path.join(candidate, 'index.md'));
  }

  const existing = resolvedCandidates.find((item) => fileExists(item));
  return existing ?? null;
}

function sanitizeAnchor(anchor) {
  return safeDecodeUri(anchor).replace(/^#/, '').trim();
}

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function safeDecodeUri(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isFenceBoundary(line) {
  return /^(```|~~~)/.test(line.trim());
}

function fileExists(targetPath) {
  try {
    return statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

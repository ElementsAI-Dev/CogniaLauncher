import { cognia } from '@cognia/plugin-sdk';

type Operation = 'convert' | 'preflight';
type Severity = 'info' | 'warning' | 'error';
type BundleMode = 'universal';

type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_OPERATION'
  | 'JAVA_NOT_FOUND'
  | 'BUNDLETOOL_NOT_FOUND'
  | 'AAB_NOT_FOUND'
  | 'OUTPUT_NOT_WRITABLE'
  | 'SIGNING_CONFIG_INVALID'
  | 'OUTPUT_EXISTS'
  | 'COMMAND_FAILED'
  | 'UNIVERSAL_APK_NOT_FOUND';

type ConvertInput = {
  operation: Operation;
  aabPath: string;
  outputApkPath?: string;
  outputApksPath?: string;
  extractDirPath?: string;
  bundletoolJarPath: string;
  javaPath: string;
  mode: BundleMode;
  overwrite: boolean;
  cleanup: boolean;
  keepApks: boolean;
  keepExtracted: boolean;
  ksPath?: string;
  ksPass?: string;
  ksKeyAlias?: string;
  keyPass?: string;
};

type ProcessStep = {
  step: string;
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  durationMs: number;
};

type PreflightCheck = {
  id: string;
  ok: boolean;
  severity: Severity;
  message: string;
  errorCode?: ErrorCode;
  recommendation?: string;
  command?: string;
  args?: string[];
  exitCode?: number;
  stdout?: string;
  stderr?: string;
};

type OperationResult = {
  ok: boolean;
  operation: Operation;
  message: string;
  severity: Severity;
  errorCode?: ErrorCode;
  recommendations?: string[];
  elapsedMs?: number;
  apkPath?: string;
  apksPath?: string;
  extractDirPath?: string;
  steps?: ProcessStep[];
  checks?: PreflightCheck[];
  input?: Record<string, unknown>;
};

type ParseInputResult = { help: OperationResult } | { input: ConvertInput };

type CommandProbe = {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  durationMs: number;
};

type ConversionPlan = {
  outputApkPath: string;
  outputDir: string;
  apksPath: string;
  extractDirPath: string;
};

type FailureContext = {
  steps?: ProcessStep[];
  checks?: PreflightCheck[];
  input?: Record<string, unknown>;
  recommendations?: string[];
};

const DEFAULT_BUNDLETOOL = 'bundletool.jar';
const DEFAULT_JAVA = 'java';
const DEFAULT_MODE: BundleMode = 'universal';
const WRITE_PROBE_FILE = '.aab2apk-write-probe.tmp';

class PluginError extends Error {
  code: ErrorCode;
  severity: Severity;
  recommendations: string[];
  details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    recommendations: string[] = [],
    severity: Severity = 'error',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PluginError';
    this.code = code;
    this.severity = severity;
    this.recommendations = recommendations;
    this.details = details;
  }
}

function convert_aab_to_apk(): number {
  const rawInput = Host.inputString();
  const startedAt = Date.now();

  try {
    const parsed = parseInput(rawInput);
    if ('help' in parsed) {
      Host.outputString(JSON.stringify(parsed.help));
      return 0;
    }

    const result =
      parsed.input.operation === 'preflight' ? runPreflight(parsed.input) : runConversion(parsed.input);

    result.elapsedMs = Date.now() - startedAt;
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    const operation = inferOperationFromRawInput(rawInput);
    const failure = buildFailureResult(operation, error);
    failure.elapsedMs = Date.now() - startedAt;
    Host.outputString(JSON.stringify(failure));
    return 0;
  }
}

function parseInput(raw: string): ParseInputResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      help: {
        ok: false,
        operation: 'convert',
        severity: 'warning',
        message: 'Input is required. Provide JSON or a plain .aab file path.',
        recommendations: [
          'Use quick input for default conversion, or JSON input for preflight and advanced options.',
        ],
        input: {
          quickInput: 'D:/android/app-release.aab',
          convertExample: {
            operation: 'convert',
            aabPath: 'D:/android/app-release.aab',
            outputApkPath: 'D:/android/app-universal.apk',
            bundletoolJarPath: 'D:/tools/bundletool-all-1.17.2.jar',
            javaPath: 'java',
            overwrite: true,
            cleanup: true,
            keepApks: false,
            keepExtracted: false,
          },
          preflightExample: {
            operation: 'preflight',
            aabPath: 'D:/android/app-release.aab',
            outputApkPath: 'D:/android/app-universal.apk',
            bundletoolJarPath: 'D:/tools/bundletool-all-1.17.2.jar',
            javaPath: 'java',
          },
        },
      },
    };
  }

  const parsedRaw = parseRawObject(trimmed);
  const operationRaw = readOptionalString(parsedRaw.operation, 'operation') ?? 'convert';
  const operation = parseOperation(operationRaw);

  const aabPath = normalizePath(readRequiredString(parsedRaw.aabPath, 'aabPath'));
  if (!aabPath) {
    throw new PluginError('INVALID_INPUT', 'aabPath is required.', ['Provide "aabPath" in plugin input.']);
  }
  if (!aabPath.toLowerCase().endsWith('.aab')) {
    throw new PluginError('INVALID_INPUT', `aabPath must end with .aab: ${aabPath}`, [
      'Provide a valid Android App Bundle path ending with .aab.',
    ]);
  }

  const outputApkPath = normalizePath(readOptionalString(parsedRaw.outputApkPath, 'outputApkPath'));
  const outputApksPath = normalizePath(readOptionalString(parsedRaw.outputApksPath, 'outputApksPath'));
  const extractDirPath = normalizePath(readOptionalString(parsedRaw.extractDirPath, 'extractDirPath'));
  if (outputApkPath && !outputApkPath.toLowerCase().endsWith('.apk')) {
    throw new PluginError('INVALID_INPUT', `outputApkPath must end with .apk: ${outputApkPath}`, [
      'Provide an .apk output path, or omit outputApkPath to use defaults.',
    ]);
  }

  if (outputApksPath && !outputApksPath.toLowerCase().endsWith('.apks')) {
    throw new PluginError('INVALID_INPUT', `outputApksPath must end with .apks: ${outputApksPath}`, [
      'Provide a .apks output path for intermediate bundle artifacts.',
    ]);
  }

  if (outputApkPath && outputApksPath && pathsEquivalent(outputApkPath, outputApksPath)) {
    throw new PluginError(
      'INVALID_INPUT',
      'outputApkPath and outputApksPath must not point to the same file.',
      ['Use separate output paths for .apk and .apks artifacts.'],
    );
  }

  const mode = (readOptionalString(parsedRaw.mode, 'mode') ?? DEFAULT_MODE).toLowerCase();
  if (mode !== DEFAULT_MODE) {
    throw new PluginError('INVALID_INPUT', `Unsupported mode: ${mode}`, [
      'Set mode to "universal" or omit the field.',
    ]);
  }

  return {
    input: {
      operation,
      aabPath,
      outputApkPath,
      outputApksPath,
      extractDirPath,
      bundletoolJarPath: normalizePath(readOptionalString(parsedRaw.bundletoolJarPath, 'bundletoolJarPath')) ?? DEFAULT_BUNDLETOOL,
      javaPath: normalizePath(readOptionalString(parsedRaw.javaPath, 'javaPath')) ?? DEFAULT_JAVA,
      mode: DEFAULT_MODE,
      overwrite: readOptionalBoolean(parsedRaw.overwrite, 'overwrite') ?? true,
      cleanup: readOptionalBoolean(parsedRaw.cleanup, 'cleanup') ?? true,
      keepApks: readOptionalBoolean(parsedRaw.keepApks, 'keepApks') ?? false,
      keepExtracted: readOptionalBoolean(parsedRaw.keepExtracted, 'keepExtracted') ?? false,
      ksPath: normalizePath(readOptionalString(parsedRaw.ksPath, 'ksPath')),
      ksPass: readOptionalString(parsedRaw.ksPass, 'ksPass'),
      ksKeyAlias: readOptionalString(parsedRaw.ksKeyAlias, 'ksKeyAlias'),
      keyPass: readOptionalString(parsedRaw.keyPass, 'keyPass'),
    },
  };
}

function runPreflight(input: ConvertInput): OperationResult {
  try {
    const os = detectOs();
    const plan = buildConversionPlan(input);
    const checks = runPreflightChecks(input, os, plan);
    const failedChecks = checks.filter((check) => !check.ok);

    return {
      ok: failedChecks.length === 0,
      operation: 'preflight',
      message: failedChecks.length === 0 ? 'Preflight checks passed.' : 'Preflight checks failed.',
      severity: failedChecks.length === 0 ? 'info' : 'error',
      errorCode: failedChecks[0]?.errorCode,
      recommendations: collectRecommendationsFromChecks(failedChecks),
      checks,
      input: sanitizeInput(input),
    };
  } catch (error) {
    return buildFailureResult('preflight', error, { input: sanitizeInput(input) });
  }
}

function runConversion(input: ConvertInput): OperationResult {
  const steps: ProcessStep[] = [];
  const inputSnapshot = sanitizeInput(input);

  try {
    const os = detectOs();
    const plan = buildConversionPlan(input);
    const checks = runPreflightChecks(input, os, plan);
    const failedChecks = checks.filter((check) => !check.ok);

    if (failedChecks.length > 0) {
      return {
        ok: false,
        operation: 'convert',
        message: 'Preflight checks failed. Conversion aborted before build execution.',
        severity: 'error',
        errorCode: failedChecks[0]?.errorCode,
        recommendations: collectRecommendationsFromChecks(failedChecks),
        checks,
        steps,
        input: inputSnapshot,
      };
    }

    enforceOverwritePolicy(os, plan, input.overwrite);
    ensureDir(os, plan.outputDir, steps);

    runChecked(
      'build-apks',
      input.javaPath,
      buildBuildApksArgs(input, plan),
      undefined,
      steps,
      'COMMAND_FAILED',
      'Review bundletool stderr output and verify signing or path arguments.',
    );

    extractApksArchive(os, plan.apksPath, plan.extractDirPath, steps);
    const universalApkPath = findUniversalApk(os, plan.extractDirPath, steps);
    copyFile(os, universalApkPath, plan.outputApkPath, steps);

    cleanupArtifacts(os, input, plan, steps);

    const keptApks = !input.cleanup || input.keepApks;
    const keptExtractDir = !input.cleanup || input.keepExtracted;

    return {
      ok: true,
      operation: 'convert',
      message: 'AAB converted to universal APK successfully.',
      severity: 'info',
      apkPath: plan.outputApkPath,
      apksPath: keptApks ? plan.apksPath : undefined,
      extractDirPath: keptExtractDir ? plan.extractDirPath : undefined,
      steps,
      checks,
      recommendations: keptExtractDir || keptApks
        ? ['Intermediate artifacts were kept based on cleanup policy.']
        : [],
      input: inputSnapshot,
    };
  } catch (error) {
    return buildFailureResult('convert', error, { steps, input: inputSnapshot });
  }
}

function runPreflightChecks(input: ConvertInput, os: string, plan: ConversionPlan): PreflightCheck[] {
  const checks: PreflightCheck[] = [];

  checks.push(buildSigningConfigurationCheck(input));

  checks.push(
    runCommandCheck({
      id: 'java-runtime',
      successMessage: 'Java runtime is available.',
      failureMessage: 'Java runtime is not available or not executable.',
      errorCode: 'JAVA_NOT_FOUND',
      recommendation: 'Install Java or set javaPath to a valid executable.',
      probe: () => executeCommand(input.javaPath, ['-version']),
    }),
  );

  checks.push(
    runCommandCheck({
      id: 'bundletool-runtime',
      successMessage: 'Bundletool jar is accessible and executable.',
      failureMessage: 'Bundletool jar check failed.',
      errorCode: 'BUNDLETOOL_NOT_FOUND',
      recommendation: 'Verify bundletoolJarPath and ensure java can execute the jar.',
      probe: () => executeCommand(input.javaPath, ['-jar', input.bundletoolJarPath, 'help']),
    }),
  );

  checks.push(
    runFileReadableCheck(
      os,
      'aab-input',
      input.aabPath,
      'AAB input path is readable.',
      'AAB input file is missing or not readable.',
      'AAB_NOT_FOUND',
      'Provide an existing .aab file path with read permission.',
    ),
  );

  checks.push(runOutputDirWritableCheck(os, plan.outputDir));

  if (input.ksPath) {
    checks.push(
      runFileReadableCheck(
        os,
        'keystore-file',
        input.ksPath,
        'Keystore file is readable.',
        'Keystore file is missing or not readable.',
        'SIGNING_CONFIG_INVALID',
        'Verify ksPath points to a readable keystore file.',
      ),
    );
  }

  return checks;
}

function buildSigningConfigurationCheck(input: ConvertInput): PreflightCheck {
  try {
    validateSigningConfiguration(input);
    return {
      id: 'signing-config',
      ok: true,
      severity: 'info',
      message: input.ksPath
        ? 'Signing field combinations are valid.'
        : 'Signing is not configured; unsigned/default bundletool behavior will be used.',
    };
  } catch (error) {
    const pluginError = toPluginError(error, 'SIGNING_CONFIG_INVALID');
    return {
      id: 'signing-config',
      ok: false,
      severity: 'error',
      message: pluginError.message,
      errorCode: pluginError.code,
      recommendation: pluginError.recommendations[0],
    };
  }
}
function validateSigningConfiguration(input: ConvertInput): void {
  const hasSigningField = Boolean(input.ksPath || input.ksPass || input.ksKeyAlias || input.keyPass);
  if (!hasSigningField) {
    return;
  }

  if (!input.ksPath) {
    throw new PluginError('SIGNING_CONFIG_INVALID', 'ksPath is required when signing fields are provided.', [
      'Set ksPath or remove signing fields.',
    ]);
  }

  if (!input.ksPass) {
    throw new PluginError('SIGNING_CONFIG_INVALID', 'ksPass is required when ksPath is provided.', [
      'Provide ksPass as pass:<value>, env:<NAME>, or file:<path>.',
    ]);
  }

  if (!input.ksKeyAlias) {
    throw new PluginError('SIGNING_CONFIG_INVALID', 'ksKeyAlias is required when ksPath is provided.', [
      'Provide ksKeyAlias for the keystore key entry.',
    ]);
  }
}

function buildConversionPlan(input: ConvertInput): ConversionPlan {
  const outputApkPath = input.outputApkPath ?? deriveOutputApkPath(input.aabPath);
  if (!outputApkPath.toLowerCase().endsWith('.apk')) {
    throw new PluginError('INVALID_INPUT', `Resolved outputApkPath must end with .apk: ${outputApkPath}`, [
      'Set outputApkPath to a valid .apk filename.',
    ]);
  }

  const outputDir = dirname(outputApkPath);
  const outputStem = stripExtension(outputApkPath);
  const apksPath = input.outputApksPath ?? `${outputStem}.apks`;
  const extractDirPath = input.extractDirPath ?? `${outputStem}-extract`;

  if (!apksPath.toLowerCase().endsWith('.apks')) {
    throw new PluginError('INVALID_INPUT', `Resolved apksPath must end with .apks: ${apksPath}`, [
      'Set outputApksPath to a .apks filename.',
    ]);
  }

  if (pathsEquivalent(apksPath, outputApkPath)) {
    throw new PluginError('INVALID_INPUT', 'outputApkPath and outputApksPath must be different files.', [
      'Provide distinct paths for APK and APKS artifacts.',
    ]);
  }

  return {
    outputApkPath,
    outputDir,
    apksPath,
    extractDirPath,
  };
}

function buildBuildApksArgs(input: ConvertInput, plan: ConversionPlan): string[] {
  const args: string[] = [
    '-jar',
    input.bundletoolJarPath,
    'build-apks',
    `--bundle=${input.aabPath}`,
    `--output=${plan.apksPath}`,
    `--mode=${input.mode}`,
  ];

  if (input.overwrite) {
    args.push('--overwrite');
  }

  if (input.ksPath) {
    args.push(`--ks=${input.ksPath}`);
  }
  if (input.ksPass) {
    args.push(`--ks-pass=${normalizeSecret(input.ksPass)}`);
  }
  if (input.ksKeyAlias) {
    args.push(`--ks-key-alias=${input.ksKeyAlias}`);
  }
  if (input.keyPass) {
    args.push(`--key-pass=${normalizeSecret(input.keyPass)}`);
  }

  return args;
}

function enforceOverwritePolicy(os: string, plan: ConversionPlan, overwrite: boolean): void {
  if (overwrite) {
    return;
  }

  if (pathExists(os, plan.outputApkPath)) {
    throw new PluginError('OUTPUT_EXISTS', `outputApkPath already exists: ${plan.outputApkPath}`, [
      'Set overwrite=true or choose a different outputApkPath.',
    ]);
  }

  if (pathExists(os, plan.apksPath)) {
    throw new PluginError('OUTPUT_EXISTS', `outputApksPath already exists: ${plan.apksPath}`, [
      'Set overwrite=true or choose a different outputApksPath.',
    ]);
  }
}

function runCommandCheck(params: {
  id: string;
  successMessage: string;
  failureMessage: string;
  errorCode: ErrorCode;
  recommendation: string;
  probe: () => CommandProbe;
}): PreflightCheck {
  const probe = params.probe();
  const ok = probe.exitCode === 0;

  return {
    id: params.id,
    ok,
    severity: ok ? 'info' : 'error',
    message: ok ? params.successMessage : params.failureMessage,
    errorCode: ok ? undefined : params.errorCode,
    recommendation: ok ? undefined : params.recommendation,
    command: probe.command,
    args: probe.args.map(redactArg),
    exitCode: probe.exitCode,
    stdout: probe.stdout,
    stderr: probe.stderr,
  };
}

function runFileReadableCheck(
  os: string,
  id: string,
  path: string,
  successMessage: string,
  failureMessage: string,
  errorCode: ErrorCode,
  recommendation: string,
): PreflightCheck {
  const windowsScript = [
    "$ErrorActionPreference='Stop'",
    `if (-not (Test-Path -LiteralPath '${escapePs(path)}' -PathType Leaf)) { throw 'File does not exist or is not readable.' }`,
  ].join('; ');
  const unixScript = `test -r '${escapeSh(path)}'`;

  const probe = runScriptProbe(os, windowsScript, unixScript);
  const ok = probe.exitCode === 0;

  return {
    id,
    ok,
    severity: ok ? 'info' : 'error',
    message: ok ? successMessage : failureMessage,
    errorCode: ok ? undefined : errorCode,
    recommendation: ok ? undefined : recommendation,
    command: probe.command,
    args: probe.args.map(redactArg),
    exitCode: probe.exitCode,
    stdout: probe.stdout,
    stderr: probe.stderr,
  };
}

function runOutputDirWritableCheck(os: string, outputDir: string): PreflightCheck {
  const probePath = joinPath(outputDir || '.', WRITE_PROBE_FILE);
  const windowsScript = [
    "$ErrorActionPreference='Stop'",
    `New-Item -ItemType Directory -Path '${escapePs(outputDir)}' -Force | Out-Null`,
    `$probe = '${escapePs(probePath)}'`,
    `Set-Content -LiteralPath $probe -Value 'probe'`,
    `Remove-Item -LiteralPath $probe -Force`,
  ].join('; ');

  const unixScript = [
    `mkdir -p '${escapeSh(outputDir)}'`,
    `touch '${escapeSh(probePath)}'`,
    `rm -f '${escapeSh(probePath)}'`,
  ].join(' && ');

  const probe = runScriptProbe(os, windowsScript, unixScript);
  const ok = probe.exitCode === 0;

  return {
    id: 'output-dir-writable',
    ok,
    severity: ok ? 'info' : 'error',
    message: ok ? 'Output directory is writable.' : 'Output directory is not writable.',
    errorCode: ok ? undefined : 'OUTPUT_NOT_WRITABLE',
    recommendation: ok ? undefined : 'Choose a writable output path or adjust filesystem permissions.',
    command: probe.command,
    args: probe.args.map(redactArg),
    exitCode: probe.exitCode,
    stdout: probe.stdout,
    stderr: probe.stderr,
  };
}
function runScriptProbe(os: string, windowsScript: string, unixScript: string): CommandProbe {
  if (os === 'windows') {
    return runFallbackProbe([
      {
        command: 'powershell',
        args: ['-NoProfile', '-NonInteractive', '-Command', windowsScript],
      },
      {
        command: 'pwsh',
        args: ['-NoProfile', '-NonInteractive', '-Command', windowsScript],
      },
    ]);
  }

  return executeCommand('sh', ['-c', unixScript]);
}

function pathExists(os: string, path: string): boolean {
  const windowsScript = `if (Test-Path -LiteralPath '${escapePs(path)}') { exit 0 } else { exit 1 }`;
  const unixScript = `test -e '${escapeSh(path)}'`;
  const probe = runScriptProbe(os, windowsScript, unixScript);
  return probe.exitCode === 0;
}

function runChecked(
  step: string,
  command: string,
  args: string[],
  cwd: string | undefined,
  steps: ProcessStep[],
  errorCode: ErrorCode,
  recommendation: string,
): ProcessStep {
  const probe = executeCommand(command, args, cwd);
  const recorded: ProcessStep = {
    step,
    command: probe.command,
    args: probe.args.map(redactArg),
    exitCode: probe.exitCode,
    stdout: probe.stdout,
    stderr: probe.stderr,
    startedAt: probe.startedAt,
    durationMs: probe.durationMs,
  };
  steps.push(recorded);

  if (probe.exitCode !== 0) {
    throw new PluginError(errorCode, `Step failed: ${step} (exit ${probe.exitCode}).`, [recommendation], 'error', {
      step: recorded,
    });
  }

  return recorded;
}

function runCheckedWithFallback(
  step: string,
  commands: Array<{ command: string; args: string[] }>,
  steps: ProcessStep[],
  errorCode: ErrorCode,
  recommendation: string,
): ProcessStep {
  let lastError: unknown = null;

  for (const item of commands) {
    try {
      return runChecked(step, item.command, item.args, undefined, steps, errorCode, recommendation);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new PluginError(errorCode, `Step failed: ${step}`, [recommendation]);
}

function runFallbackProbe(commands: Array<{ command: string; args: string[] }>): CommandProbe {
  const failures: CommandProbe[] = [];

  for (const candidate of commands) {
    const probe = executeCommand(candidate.command, candidate.args);
    if (probe.exitCode === 0) {
      return probe;
    }
    failures.push(probe);
  }

  const last = failures[failures.length - 1];
  if (!last) {
    return {
      command: commands[0]?.command ?? 'unknown',
      args: commands[0]?.args ?? [],
      exitCode: 1,
      stdout: '',
      stderr: 'No commands were provided.',
      startedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  return {
    ...last,
    stderr: failures
      .map((probe) => {
        const cmdLine = `${probe.command} ${probe.args.join(' ')}`.trim();
        const output = [probe.stdout, probe.stderr].filter(Boolean).join('\n');
        return output ? `${cmdLine}\n${output}` : cmdLine;
      })
      .join('\n\n'),
  };
}

function executeCommand(command: string, args: string[], cwd?: string): CommandProbe {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  try {
    const result = cognia.process.exec(command, args, cwd ?? null);
    return {
      command,
      args,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      command,
      args,
      exitCode: 1,
      stdout: '',
      stderr: message,
      startedAt,
      durationMs: Date.now() - start,
    };
  }
}

function ensureDir(os: string, dirPath: string, steps: ProcessStep[]): void {
  if (!dirPath || dirPath === '.') {
    return;
  }

  if (os === 'windows') {
    const script = `$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Path '${escapePs(dirPath)}' -Force | Out-Null`;
    runCheckedWithFallback(
      'ensure-output-dir',
      [
        { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
        { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
      ],
      steps,
      'OUTPUT_NOT_WRITABLE',
      'Use a writable output directory.',
    );
    return;
  }

  runChecked('ensure-output-dir', 'mkdir', ['-p', dirPath], undefined, steps, 'OUTPUT_NOT_WRITABLE', 'Use a writable output directory.');
}

function extractApksArchive(os: string, apksPath: string, extractDir: string, steps: ProcessStep[]): void {
  if (os === 'windows') {
    const script = `$ErrorActionPreference='Stop'; Expand-Archive -Path '${escapePs(apksPath)}' -DestinationPath '${escapePs(extractDir)}' -Force`;
    runCheckedWithFallback(
      'extract-apks-archive',
      [
        { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
        { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
      ],
      steps,
      'COMMAND_FAILED',
      'Ensure PowerShell archive extraction is available and output paths are valid.',
    );
    return;
  }

  runChecked(
    'extract-apks-archive',
    'unzip',
    ['-o', apksPath, '-d', extractDir],
    undefined,
    steps,
    'COMMAND_FAILED',
    'Install unzip or verify .apks archive accessibility.',
  );
}
function findUniversalApk(os: string, extractDir: string, steps: ProcessStep[]): string {
  if (os === 'windows') {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$apk = Get-ChildItem -Path '${escapePs(extractDir)}' -Recurse -Filter 'universal.apk' | Select-Object -First 1 -ExpandProperty FullName`,
      `if (-not $apk) { throw 'universal.apk not found in extracted .apks archive' }`,
      'Write-Output $apk',
    ].join('; ');

    const step = runCheckedWithFallback(
      'find-universal-apk',
      [
        { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
        { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
      ],
      steps,
      'UNIVERSAL_APK_NOT_FOUND',
      'Make sure build-apks used mode=universal and extraction completed successfully.',
    );

    const path = firstNonEmptyLine(step.stdout);
    if (!path) {
      throw new PluginError('UNIVERSAL_APK_NOT_FOUND', 'Failed to locate universal.apk after extraction.', [
        'Inspect extracted contents and verify bundletool output mode.',
      ]);
    }
    return path;
  }

  const step = runChecked(
    'find-universal-apk',
    'find',
    [extractDir, '-name', 'universal.apk', '-print', '-quit'],
    undefined,
    steps,
    'UNIVERSAL_APK_NOT_FOUND',
    'Make sure build-apks used mode=universal and extraction completed successfully.',
  );

  const path = firstNonEmptyLine(step.stdout);
  if (!path) {
    throw new PluginError('UNIVERSAL_APK_NOT_FOUND', 'Failed to locate universal.apk after extraction.', [
      'Inspect extracted contents and verify bundletool output mode.',
    ]);
  }

  return path;
}

function copyFile(os: string, sourcePath: string, outputPath: string, steps: ProcessStep[]): void {
  if (os === 'windows') {
    const script = `$ErrorActionPreference='Stop'; Copy-Item -LiteralPath '${escapePs(sourcePath)}' -Destination '${escapePs(outputPath)}' -Force`;
    runCheckedWithFallback(
      'copy-apk',
      [
        { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
        { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
      ],
      steps,
      'COMMAND_FAILED',
      'Verify output path is writable and source APK exists.',
    );
    return;
  }

  runChecked(
    'copy-apk',
    'cp',
    ['-f', sourcePath, outputPath],
    undefined,
    steps,
    'COMMAND_FAILED',
    'Verify output path is writable and source APK exists.',
  );
}

function cleanupArtifacts(os: string, input: ConvertInput, plan: ConversionPlan, steps: ProcessStep[]): void {
  if (!input.cleanup) {
    return;
  }

  if (!input.keepApks) {
    removeFile(os, plan.apksPath, 'cleanup-apks', steps);
  }

  if (!input.keepExtracted) {
    removeDir(os, plan.extractDirPath, 'cleanup-extract-dir', steps);
  }
}

function removeFile(os: string, path: string, step: string, steps: ProcessStep[]): void {
  if (os === 'windows') {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      `Remove-Item -LiteralPath '${escapePs(path)}' -Force`,
      'exit 0',
    ].join('; ');

    runCheckedWithFallback(
      step,
      [
        { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
        { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
      ],
      steps,
      'COMMAND_FAILED',
      'Cleanup failed for intermediate APKS artifact.',
    );
    return;
  }

  runChecked(step, 'rm', ['-f', path], undefined, steps, 'COMMAND_FAILED', 'Cleanup failed for intermediate APKS artifact.');
}

function removeDir(os: string, path: string, step: string, steps: ProcessStep[]): void {
  if (os === 'windows') {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      `Remove-Item -LiteralPath '${escapePs(path)}' -Recurse -Force`,
      'exit 0',
    ].join('; ');

    runCheckedWithFallback(
      step,
      [
        { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
        { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
      ],
      steps,
      'COMMAND_FAILED',
      'Cleanup failed for extraction directory.',
    );
    return;
  }

  runChecked(step, 'rm', ['-rf', path], undefined, steps, 'COMMAND_FAILED', 'Cleanup failed for extraction directory.');
}

function buildFailureResult(operation: Operation, error: unknown, context: FailureContext = {}): OperationResult {
  const pluginError = toPluginError(error, 'COMMAND_FAILED');
  const recommendations = uniqueValues([
    ...pluginError.recommendations,
    ...(context.recommendations ?? []),
    ...collectRecommendationsFromChecks((context.checks ?? []).filter((check) => !check.ok)),
  ]);

  return {
    ok: false,
    operation,
    message: pluginError.message,
    severity: pluginError.severity,
    errorCode: pluginError.code,
    recommendations: recommendations.length > 0 ? recommendations : ['Inspect diagnostics and retry.'],
    steps: context.steps,
    checks: context.checks,
    input: context.input,
  };
}

function toPluginError(error: unknown, fallbackCode: ErrorCode): PluginError {
  if (error instanceof PluginError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new PluginError(fallbackCode, message, ['Inspect command stderr output and adjust configuration.']);
}

function collectRecommendationsFromChecks(checks: PreflightCheck[]): string[] {
  const recommendations = checks
    .map((check) => check.recommendation)
    .filter((item): item is string => Boolean(item));
  return uniqueValues(recommendations);
}

function sanitizeInput(input: ConvertInput): Record<string, unknown> {
  return {
    ...input,
    ksPass: input.ksPass ? '***' : undefined,
    keyPass: input.keyPass ? '***' : undefined,
  };
}
function parseRawObject(trimmed: string): Record<string, unknown> {
  if (!trimmed.startsWith('{')) {
    return { aabPath: trimmed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PluginError('INVALID_INPUT', `Failed to parse JSON input: ${message}`, [
      'Provide valid JSON input, or use plain .aab quick input.',
    ]);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PluginError('INVALID_INPUT', 'JSON input must be an object.', [
      'Use a JSON object with fields like aabPath, operation, and outputApkPath.',
    ]);
  }

  return parsed as Record<string, unknown>;
}

function readRequiredString(value: unknown, fieldName: string): string {
  const parsed = readOptionalString(value, fieldName);
  if (!parsed) {
    throw new PluginError('INVALID_INPUT', `${fieldName} is required.`, [`Provide "${fieldName}" in plugin input.`]);
  }
  return parsed;
}

function readOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new PluginError('INVALID_INPUT', `${fieldName} must be a string.`, [
      `Provide "${fieldName}" as a string value.`,
    ]);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new PluginError('INVALID_INPUT', `${fieldName} must be a boolean.`, [
      `Set "${fieldName}" to true or false.`,
    ]);
  }

  return value;
}

function parseOperation(value: string): Operation {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'convert' || normalized === 'preflight') {
    return normalized;
  }

  throw new PluginError('UNSUPPORTED_OPERATION', `Unsupported operation: ${value}`, [
    'Use operation "convert" or "preflight".',
  ]);
}

function inferOperationFromRawInput(raw: string): Operation {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) {
    return 'convert';
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const operation = typeof parsed.operation === 'string' ? parsed.operation.toLowerCase() : '';
    return operation === 'preflight' ? 'preflight' : 'convert';
  } catch {
    return 'convert';
  }
}

function normalizeSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('pass:') || trimmed.startsWith('file:') || trimmed.startsWith('env:')) {
    return trimmed;
  }

  return `pass:${trimmed}`;
}

function normalizePath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function deriveOutputApkPath(aabPath: string): string {
  const lower = aabPath.toLowerCase();
  if (lower.endsWith('.aab')) {
    return `${aabPath.slice(0, -4)}-universal.apk`;
  }
  return `${aabPath}-universal.apk`;
}

function dirname(path: string): string {
  const slash = path.lastIndexOf('/');
  const backslash = path.lastIndexOf('\\');
  const idx = Math.max(slash, backslash);

  if (idx < 0) {
    return '.';
  }
  if (idx === 0) {
    return path.slice(0, 1);
  }
  return path.slice(0, idx);
}

function joinPath(dir: string, fileName: string): string {
  if (!dir || dir === '.') {
    return fileName;
  }

  if (dir.endsWith('/') || dir.endsWith('\\')) {
    return `${dir}${fileName}`;
  }

  const separator = dir.includes('\\') ? '\\' : '/';
  return `${dir}${separator}${fileName}`;
}

function stripExtension(path: string): string {
  const slash = path.lastIndexOf('/');
  const backslash = path.lastIndexOf('\\');
  const boundary = Math.max(slash, backslash);
  const dot = path.lastIndexOf('.');

  if (dot <= boundary) {
    return path;
  }

  return path.slice(0, dot);
}

function pathsEquivalent(a: string, b: string): boolean {
  const left = normalizeComparePath(a);
  const right = normalizeComparePath(b);
  return left === right;
}

function normalizeComparePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

function redactArg(arg: string): string {
  if (arg.startsWith('--ks-pass=')) {
    return '--ks-pass=***';
  }
  if (arg.startsWith('--key-pass=')) {
    return '--key-pass=***';
  }
  return arg;
}

function firstNonEmptyLine(text: string): string | null {
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  return line ?? null;
}
function escapePs(input: string): string {
  return input.replace(/'/g, "''");
}

function escapeSh(input: string): string {
  return input.replace(/'/g, "'\\''");
}

function detectOs(): string {
  return cognia.platform.info().os;
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

declare const module: { exports: unknown };

module.exports = {
  convert_aab_to_apk,
  __test: {
    parseInput,
    buildConversionPlan,
    buildBuildApksArgs,
    sanitizeInput,
    validateSigningConfiguration,
    redactArg,
    inferOperationFromRawInput,
  },
};

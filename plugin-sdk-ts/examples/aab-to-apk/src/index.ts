import { cognia } from '@cognia/plugin-sdk';

type ConvertInput = {
  aabPath: string;
  outputApkPath?: string;
  bundletoolJarPath?: string;
  javaPath?: string;
  overwrite?: boolean;
  cleanup?: boolean;
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
};

type ConvertResult = {
  ok: boolean;
  message: string;
  apkPath?: string;
  apksPath?: string;
  elapsedMs?: number;
  steps?: ProcessStep[];
  input?: Record<string, unknown>;
};

function convert_aab_to_apk(): number {
  const rawInput = Host.inputString();

  try {
    const parsed = parseInput(rawInput);
    if ('help' in parsed) {
      Host.outputString(JSON.stringify(parsed.help));
      return 0;
    }

    const start = Date.now();
    const result = runConversion(parsed.input);
    result.elapsedMs = Date.now() - start;

    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cognia.log.error(`[aab-to-apk] ${message}`);
    throw new Error(message);
  }
}

function parseInput(raw: string): { help: ConvertResult } | { input: ConvertInput } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      help: {
        ok: false,
        message: 'Input is required. Provide JSON or just a .aab file path.',
        input: {
          exampleJson: {
            aabPath: 'D:/android/app-release.aab',
            bundletoolJarPath: 'D:/tools/bundletool-all-1.17.2.jar',
            outputApkPath: 'D:/android/app-universal.apk',
            javaPath: 'java',
            overwrite: true,
            cleanup: true,
          },
          quickInput: 'D:/android/app-release.aab',
        },
      },
    };
  }

  let parsed: Partial<ConvertInput>;

  if (trimmed.startsWith('{')) {
    try {
      parsed = JSON.parse(trimmed) as Partial<ConvertInput>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse JSON input: ${message}`);
    }
  } else {
    parsed = { aabPath: trimmed };
  }

  const aabPath = normalizePath(parsed.aabPath);
  if (!aabPath) {
    throw new Error('aabPath is required.');
  }

  if (!aabPath.toLowerCase().endsWith('.aab')) {
    throw new Error(`aabPath must end with .aab: ${aabPath}`);
  }

  return {
    input: {
      aabPath,
      outputApkPath: normalizePath(parsed.outputApkPath),
      bundletoolJarPath: normalizePath(parsed.bundletoolJarPath) || 'bundletool.jar',
      javaPath: normalizePath(parsed.javaPath) || 'java',
      overwrite: parsed.overwrite ?? true,
      cleanup: parsed.cleanup ?? true,
      ksPath: normalizePath(parsed.ksPath),
      ksPass: parsed.ksPass,
      ksKeyAlias: parsed.ksKeyAlias,
      keyPass: parsed.keyPass,
    },
  };
}

function runConversion(input: ConvertInput): ConvertResult {
  const os = cognia.platform.info().os;
  const steps: ProcessStep[] = [];

  const outputApkPath =
    input.outputApkPath && input.outputApkPath.trim()
      ? input.outputApkPath
      : deriveOutputApkPath(input.aabPath);

  const outputDir = dirname(outputApkPath);
  const tempTag = `aab2apk-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const apksPath = joinPath(outputDir, `${tempTag}.apks`);
  const extractDir = joinPath(outputDir, `${tempTag}-extract`);

  cognia.log.info(`[aab-to-apk] Converting ${input.aabPath}`);

  ensureDir(os, outputDir, steps);

  const buildArgs: string[] = [
    '-jar',
    input.bundletoolJarPath || 'bundletool.jar',
    'build-apks',
    `--bundle=${input.aabPath}`,
    `--output=${apksPath}`,
    '--mode=universal',
  ];

  if (input.overwrite !== false) {
    buildArgs.push('--overwrite');
  }

  if (input.ksPath) {
    buildArgs.push(`--ks=${input.ksPath}`);
  }
  if (input.ksPass) {
    buildArgs.push(`--ks-pass=${normalizeSecret(input.ksPass)}`);
  }
  if (input.ksKeyAlias) {
    buildArgs.push(`--ks-key-alias=${input.ksKeyAlias}`);
  }
  if (input.keyPass) {
    buildArgs.push(`--key-pass=${normalizeSecret(input.keyPass)}`);
  }

  runChecked('build-apks', input.javaPath || 'java', buildArgs, undefined, steps);
  extractApksArchive(os, apksPath, extractDir, steps);

  const universalApk = findUniversalApk(os, extractDir, steps);
  copyFile(os, universalApk, outputApkPath, steps);

  if (input.cleanup !== false) {
    cleanupTemp(os, apksPath, extractDir, steps);
  }

  return {
    ok: true,
    message: 'AAB converted to universal APK successfully.',
    apkPath: outputApkPath,
    apksPath,
    steps,
  };
}

function runChecked(
  step: string,
  command: string,
  args: string[],
  cwd: string | undefined,
  steps: ProcessStep[],
): ProcessStep {
  const result = cognia.process.exec(command, args, cwd ?? null);
  const recorded: ProcessStep = {
    step,
    command,
    args,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
  steps.push(recorded);

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `Step failed: ${step}`,
        `Command: ${command} ${args.join(' ')}`,
        `Exit code: ${result.exitCode}`,
        result.stdout ? `stdout:\n${result.stdout}` : '',
        result.stderr ? `stderr:\n${result.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return recorded;
}

function extractApksArchive(os: string, apksPath: string, extractDir: string, steps: ProcessStep[]): void {
  if (os === 'windows') {
    const script = `$ErrorActionPreference='Stop'; Expand-Archive -Path '${escapePs(apksPath)}' -DestinationPath '${escapePs(extractDir)}' -Force`;
    const tried = runFallbackCommands(
      'extract-apks-archive',
      [
        { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
        { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', script] },
      ],
      steps,
    );

    if (!tried) {
      throw new Error('Failed to extract .apks archive on Windows.');
    }
    return;
  }

  runChecked('extract-apks-archive', 'unzip', ['-o', apksPath, '-d', extractDir], undefined, steps);
}

function findUniversalApk(os: string, extractDir: string, steps: ProcessStep[]): string {
  if (os === 'windows') {
    const script = [
      `$ErrorActionPreference='Stop'`,
      `$apk = Get-ChildItem -Path '${escapePs(extractDir)}' -Recurse -Filter 'universal.apk' | Select-Object -First 1 -ExpandProperty FullName`,
      `if (-not $apk) { throw 'universal.apk not found in extracted .apks archive' }`,
      `Write-Output $apk`,
    ].join('; ');

    const step = runChecked(
      'find-universal-apk',
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      undefined,
      steps,
    );

    const path = firstNonEmptyLine(step.stdout);
    if (!path) {
      throw new Error('Failed to locate universal.apk after extraction.');
    }
    return path;
  }

  const step = runChecked(
    'find-universal-apk',
    'find',
    [extractDir, '-name', 'universal.apk', '-print', '-quit'],
    undefined,
    steps,
  );

  const path = firstNonEmptyLine(step.stdout);
  if (!path) {
    throw new Error('Failed to locate universal.apk after extraction.');
  }
  return path;
}

function copyFile(os: string, sourcePath: string, outputPath: string, steps: ProcessStep[]): void {
  if (os === 'windows') {
    const script = `$ErrorActionPreference='Stop'; Copy-Item -Path '${escapePs(sourcePath)}' -Destination '${escapePs(outputPath)}' -Force`;
    runChecked(
      'copy-apk',
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      undefined,
      steps,
    );
    return;
  }

  runChecked('copy-apk', 'cp', ['-f', sourcePath, outputPath], undefined, steps);
}

function cleanupTemp(os: string, apksPath: string, extractDir: string, steps: ProcessStep[]): void {
  if (os === 'windows') {
    const script = [
      `$ErrorActionPreference='SilentlyContinue'`,
      `Remove-Item -Path '${escapePs(apksPath)}' -Force`,
      `Remove-Item -Path '${escapePs(extractDir)}' -Recurse -Force`,
    ].join('; ');
    runChecked(
      'cleanup-temp',
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      undefined,
      steps,
    );
    return;
  }

  runChecked('cleanup-temp', 'rm', ['-rf', apksPath, extractDir], undefined, steps);
}

function ensureDir(os: string, dirPath: string, steps: ProcessStep[]): void {
  if (!dirPath || dirPath === '.') {
    return;
  }

  if (os === 'windows') {
    const script = `$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Path '${escapePs(dirPath)}' -Force | Out-Null`;
    runChecked(
      'ensure-output-dir',
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      undefined,
      steps,
    );
    return;
  }

  runChecked('ensure-output-dir', 'mkdir', ['-p', dirPath], undefined, steps);
}

function runFallbackCommands(
  step: string,
  commands: Array<{ command: string; args: string[] }>,
  steps: ProcessStep[],
): boolean {
  const errors: string[] = [];

  for (const item of commands) {
    try {
      runChecked(step, item.command, item.args, undefined, steps);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n\n'));
  }

  return false;
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
  if (idx < 0) return '.';
  if (idx === 0) return path.slice(0, 1);
  return path.slice(0, idx);
}

function joinPath(dir: string, fileName: string): string {
  if (!dir || dir === '.') return fileName;
  if (dir.endsWith('/') || dir.endsWith('\\')) return `${dir}${fileName}`;
  const separator = dir.includes('\\') ? '\\' : '/';
  return `${dir}${separator}${fileName}`;
}

function normalizeSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('pass:') || trimmed.startsWith('file:') || trimmed.startsWith('env:')) {
    return trimmed;
  }
  return `pass:${trimmed}`;
}

function normalizePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
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

module.exports = { convert_aab_to_apk };

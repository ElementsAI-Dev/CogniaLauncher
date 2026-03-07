import { cognia } from '@cognia/plugin-sdk';

type PortInspectInput = {
  port?: number;
  addressContains?: string;
  processNameContains?: string;
  processId?: number;
};

type CommandSpec = {
  command: string;
  args: string[];
  parser: 'netstat-windows' | 'lsof' | 'ss';
};

type PortEntry = {
  protocol: 'tcp';
  state: 'LISTEN';
  address: string;
  port: number;
  processId?: number;
  processName?: string;
  metadataMissing?: Array<'processName' | 'processId'>;
  raw: string;
};

type PortInspectResult = {
  ok: boolean;
  os: string;
  queriedPort: number | null;
  filters?: PortInspectInput;
  commandUsed?: string;
  entries?: PortEntry[];
  warnings?: string[];
  recommendations?: string[];
  errorCode?: string;
  message: string;
};

function port_inspect(): number {
  const raw = Host.inputString();
  const os = cognia.platform.info().os;

  try {
    const input = parseInput(raw);
    const result = inspectPorts(os, input);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    const result: PortInspectResult = {
      ok: false,
      os,
      queriedPort: null,
      errorCode: 'INVALID_INPUT',
      message: error instanceof Error ? error.message : 'Input must be empty, a port number, or a JSON object with filters.',
      recommendations: [
        'Provide no input to inspect all listeners.',
        'Provide a raw port like "3000" or JSON like {"port":3000,"processNameContains":"node"}.',
      ],
    };
    Host.outputString(JSON.stringify(result));
    return 1;
  }
}

function parseInput(raw: string): PortInspectInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  if (/^\d+$/.test(trimmed)) {
    return { port: parsePort(trimmed) };
  }

  const parsed = JSON.parse(trimmed) as {
    port?: unknown;
    addressContains?: unknown;
    processNameContains?: unknown;
    processId?: unknown;
  };

  return {
    port: parsed.port === undefined ? undefined : parsePort(parsed.port),
    addressContains: parseOptionalText(parsed.addressContains, 'addressContains'),
    processNameContains: parseOptionalText(parsed.processNameContains, 'processNameContains'),
    processId: parsed.processId === undefined ? undefined : parsePort(parsed.processId),
  };
}

function parseOptionalText(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }
  return value.trim() || undefined;
}

function parsePort(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }
  return numeric;
}

function inspectPorts(os: string, filters: PortInspectInput): PortInspectResult {
  const warnings: string[] = [];
  for (const spec of getCommandCandidates(os)) {
    const execution = cognia.process.exec(spec.command, spec.args);
    if (execution.exitCode !== 0) {
      warnings.push(`${spec.command} failed: ${firstLine(execution.stderr) ?? 'unknown error'}`);
      continue;
    }

    const parsedEntries = parseEntries(spec.parser, execution.stdout);
    const entries = filterEntries(enrichProcessContext(os, parsedEntries, warnings), filters);
    return {
      ok: true,
      os,
      queriedPort: filters.port ?? null,
      filters,
      commandUsed: `${spec.command} ${spec.args.join(' ')}`.trim(),
      entries,
      warnings,
      recommendations: buildRecommendations(entries, filters),
      message: 'Port inspection completed.',
    };
  }

  return {
    ok: false,
    os,
    queriedPort: filters.port ?? null,
    filters,
    errorCode: 'MISSING_TOOL',
    warnings,
    recommendations: [
      'Install a supported port inspection tool such as netstat, lsof, or ss.',
      'Retry after ensuring the command is available on PATH.',
    ],
    message: 'No supported port inspection command is available.',
  };
}

function getCommandCandidates(os: string): CommandSpec[] {
  if (os === 'windows') {
    return [
      { command: 'netstat', args: ['-ano', '-p', 'tcp'], parser: 'netstat-windows' },
    ];
  }

  return [
    { command: 'lsof', args: ['-nP', '-iTCP', '-sTCP:LISTEN'], parser: 'lsof' },
    { command: 'ss', args: ['-ltnp'], parser: 'ss' },
  ];
}

function parseEntries(parser: CommandSpec['parser'], stdout: string): PortEntry[] {
  if (parser === 'netstat-windows') {
    return parseNetstatWindows(stdout);
  }
  if (parser === 'lsof') {
    return parseLsof(stdout);
  }
  return parseSs(stdout);
}

function parseNetstatWindows(stdout: string): PortEntry[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('LISTENING'))
    .flatMap((line) => {
      const match = line.match(/^TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
      if (!match) {
        return [];
      }
      return [{
        protocol: 'tcp',
        state: 'LISTEN',
        address: match[1],
        port: Number(match[2]),
        processId: Number(match[3]),
        metadataMissing: ['processName'],
        raw: line,
      }];
    });
}

function parseLsof(stdout: string): PortEntry[] {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return [];
      }
      const match = trimmed.match(/^(\S+)\s+(\d+)\s+.*TCP\s+(.+?):(\d+)\s+\(LISTEN\)$/);
      if (!match) {
        return [];
      }
      return [{
        protocol: 'tcp',
        state: 'LISTEN',
        processName: match[1],
        processId: Number(match[2]),
        address: match[3],
        port: Number(match[4]),
        metadataMissing: [],
        raw: trimmed,
      }];
    });
}

function parseSs(stdout: string): PortEntry[] {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('LISTEN')) {
        return [];
      }
      const match = trimmed.match(/^LISTEN\s+\d+\s+\d+\s+(\S+):(\d+)\s+\S+(?:\s+users:\(\("([^"]+)",pid=(\d+),fd=\d+\)\))?/);
      if (!match) {
        return [];
      }
      const processId = match[4] ? Number(match[4]) : undefined;
      return [{
        protocol: 'tcp',
        state: 'LISTEN',
        address: match[1],
        port: Number(match[2]),
        processName: match[3],
        processId,
        metadataMissing: buildMetadataMissing(match[3], processId),
        raw: trimmed,
      }];
    });
}

function buildMetadataMissing(
  processName?: string,
  processId?: number,
): Array<'processName' | 'processId'> {
  const missing: Array<'processName' | 'processId'> = [];
  if (!processName) {
    missing.push('processName');
  }
  if (processId === undefined) {
    missing.push('processId');
  }
  return missing;
}

function enrichProcessContext(os: string, entries: PortEntry[], warnings: string[]): PortEntry[] {
  const cache = new Map<number, string | null>();

  return entries.map((entry) => {
    if (entry.processName || entry.processId === undefined) {
      return {
        ...entry,
        metadataMissing: buildMetadataMissing(entry.processName, entry.processId),
      };
    }

    const cached = cache.get(entry.processId);
    const processName = cached === undefined
      ? lookupProcessName(os, entry.processId, warnings)
      : cached;
    cache.set(entry.processId, processName);

    return {
      ...entry,
      processName: processName ?? undefined,
      metadataMissing: buildMetadataMissing(processName ?? undefined, entry.processId),
    };
  });
}

function lookupProcessName(os: string, processId: number, warnings: string[]): string | null {
  if (os === 'windows') {
    const result = cognia.process.exec('tasklist', ['/FI', `PID eq ${processId}`, '/FO', 'CSV', '/NH']);
    if (result.exitCode !== 0) {
      warnings.push(`tasklist failed for PID ${processId}: ${firstLine(result.stderr) ?? 'unknown error'}`);
      return null;
    }
    const match = firstLine(result.stdout)?.match(/^"([^"]+)"/);
    return match?.[1] ?? null;
  }

  const result = cognia.process.exec('ps', ['-p', String(processId), '-o', 'comm=']);
  if (result.exitCode !== 0) {
    warnings.push(`ps failed for PID ${processId}: ${firstLine(result.stderr) ?? 'unknown error'}`);
    return null;
  }
  return firstLine(result.stdout);
}

function filterEntries(entries: PortEntry[], filters: PortInspectInput): PortEntry[] {
  return entries.filter((entry) => {
    if (filters.port !== undefined && entry.port !== filters.port) {
      return false;
    }
    if (filters.processId !== undefined && entry.processId !== filters.processId) {
      return false;
    }
    if (filters.addressContains && !entry.address.toLowerCase().includes(filters.addressContains.toLowerCase())) {
      return false;
    }
    if (filters.processNameContains && !entry.processName?.toLowerCase().includes(filters.processNameContains.toLowerCase())) {
      return false;
    }
    return true;
  });
}

function buildRecommendations(entries: PortEntry[], filters: PortInspectInput): string[] {
  if (entries.length === 0 && hasFilters(filters)) {
    return [
      `No listening socket matched the requested filters (${describeFilters(filters)}).`,
      'Retry without one of the filters if you need a broader listener inventory.',
    ];
  }
  if (filters.port !== undefined && entries.length === 0) {
    return [`No listener currently owns TCP port ${filters.port}.`];
  }
  if (entries.length === 0) {
    return ['No listening TCP ports were detected by the selected command.'];
  }

  const items = [
    'Use the reported process ID to inspect or stop the service outside the plugin if needed.',
    'Re-run with a target port to narrow troubleshooting on localhost services.',
  ];
  if (entries.some((entry) => (entry.metadataMissing ?? []).length > 0)) {
    items.push('Some entries are missing process metadata; re-run with platform-native tools if you need elevated process detail.');
  }
  return items;
}

function hasFilters(filters: PortInspectInput): boolean {
  return filters.port !== undefined
    || filters.processId !== undefined
    || Boolean(filters.addressContains)
    || Boolean(filters.processNameContains);
}

function describeFilters(filters: PortInspectInput): string {
  const parts: string[] = [];
  if (filters.port !== undefined) {
    parts.push(`port ${filters.port}`);
  }
  if (filters.processId !== undefined) {
    parts.push(`process ID ${filters.processId}`);
  }
  if (filters.processNameContains) {
    parts.push(`process name containing "${filters.processNameContains}"`);
  }
  if (filters.addressContains) {
    parts.push(`address containing "${filters.addressContains}"`);
  }
  return parts.join(', ');
}

function firstLine(value: string): string | null {
  const line = value.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  return line ?? null;
}

declare const module: { exports: unknown };

module.exports = {
  port_inspect,
  __test: {
    parseInput,
    parseNetstatWindows,
    parseLsof,
    parseSs,
    getCommandCandidates,
    buildRecommendations,
  },
};

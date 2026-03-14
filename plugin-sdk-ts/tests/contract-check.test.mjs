import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContractParity } from '../scripts/check-contract-lib.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = path.resolve(testDir, '..');

test('contract checker command succeeds against repo sources', () => {
  const scriptPath = path.join(sdkDir, 'scripts', 'check-contract.mjs');
  const result = spawnSync('node', [scriptPath, '--json'], {
    cwd: sdkDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.stats.contractCount >= 38);
  assert.ok(parsed.stats.rustDeclarationCount >= 38);
  assert.equal(parsed.errors.length, 0);
});

test('contract validation reports undeclared TypeScript wrapper call', () => {
  const result = validateContractParity({
    contractFunctions: [
      { name: 'cognia_http_request', stability: 'stable' },
      {
        name: 'cognia_http_get',
        stability: 'compat',
        preferred: 'cognia_http_request',
      },
    ],
    runtimeFunctions: ['cognia_http_get', 'cognia_http_request'],
    declarationFunctions: ['cognia_http_get', 'cognia_http_request'],
    wrapperFunctions: ['cognia_http_get', 'cognia_http_delete'],
    rustDeclarationFunctions: ['cognia_http_get', 'cognia_http_request'],
    rustWrapperFunctions: ['cognia_http_get'],
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((line) =>
      line.includes('TypeScript wrapper calls undeclared functions: cognia_http_delete [tool-runtime]'),
    ),
    true,
  );
});

test('contract validation reports missing rust declaration', () => {
  const result = validateContractParity({
    contractFunctions: [{ name: 'cognia_event_emit', stability: 'stable' }],
    runtimeFunctions: ['cognia_event_emit'],
    declarationFunctions: ['cognia_event_emit'],
    wrapperFunctions: [],
    rustDeclarationFunctions: [],
    rustWrapperFunctions: [],
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((line) =>
      line.includes('Missing in Rust declaration (from contract): cognia_event_emit [event-listener]'),
    ),
    true,
  );
});

test('contract validation classifies cognia_log as log-listener diagnostics', () => {
  const result = validateContractParity({
    contractFunctions: [{ name: 'cognia_log', stability: 'stable' }],
    runtimeFunctions: ['cognia_log'],
    declarationFunctions: ['cognia_log'],
    wrapperFunctions: [],
    rustDeclarationFunctions: [],
    rustWrapperFunctions: [],
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((line) =>
      line.includes('Missing in Rust declaration (from contract): cognia_log [log-listener]'),
    ),
    true,
  );
});

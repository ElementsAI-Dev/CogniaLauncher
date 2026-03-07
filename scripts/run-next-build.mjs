import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const env = {
  ...process.env,
  BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA:
    process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ?? 'true',
  BROWSERSLIST_IGNORE_OLD_DATA:
    process.env.BROWSERSLIST_IGNORE_OLD_DATA ?? 'true',
};

const child = spawn(process.execPath, [nextBin, 'build', ...process.argv.slice(2)], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env,
});

const shouldSuppress = (line) => line.includes('[baseline-browser-mapping]');

function pipeFiltered(stream, target) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (shouldSuppress(line)) {
        continue;
      }
      target.write(`${line}\n`);
    }
  });

  stream.on('end', () => {
    if (buffer && !shouldSuppress(buffer)) {
      target.write(buffer);
    }
  });
}

pipeFiltered(child.stdout, process.stdout);
pipeFiltered(child.stderr, process.stderr);

child.on('error', (error) => {
  throw error;
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

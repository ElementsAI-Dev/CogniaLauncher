import { cognia } from '../../src';
import type {
  ProcessAvailabilityResult,
  ProcessExecOptions,
  ProcessLookupResult,
  ProcessOptions,
  ProcessResult,
} from '../../src';

const legacyExec: ProcessResult = cognia.process.exec('node', ['--version'], null);

const directOptions: ProcessOptions = {
  cwd: '/tmp/demo',
  env: {
    DEMO_FLAG: '1',
  },
  timeoutMs: 2_000,
  captureOutput: false,
};

const structuredOptions: ProcessExecOptions = {
  args: ['--version'],
  ...directOptions,
};

const structuredExec: ProcessResult = cognia.process.exec('node', structuredOptions);

const shellExec: ProcessResult = cognia.process.execShell('echo hello', directOptions);
const lookup: ProcessLookupResult = cognia.process.which('node');
const availability: ProcessAvailabilityResult = cognia.process.isAvailable('node');

const success: boolean = structuredExec.success;
const lookupPath: string | null = lookup.path;
const available: boolean = availability.available;

void legacyExec;
void shellExec;
void success;
void lookupPath;
void available;

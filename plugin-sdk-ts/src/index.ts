/**
 * # Cognia Plugin SDK (TypeScript)
 *
 * Type-safe TypeScript SDK for building CogniaLauncher WASM plugins.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { cognia } from '@cognia/plugin-sdk';
 *
 * function my_tool(): number {
 *   const input = Host.inputString();
 *   const platform = cognia.platform.info();
 *   cognia.log.info(`Running on ${platform.os} ${platform.arch}`);
 *
 *   const greeting = cognia.i18n.translate('greeting', { name: platform.hostname });
 *   Host.outputString(JSON.stringify({ greeting, platform: platform.os, input }));
 *   return 0;
 * }
 *
 * module.exports = { my_tool };
 * ```
 */

export * as batch from './batch';
export * as cache from './cache';
export * as clipboard from './clipboard';
export * as config from './config';
export * as download from './download';
export * as env from './env';
export * as event from './event';
export * as fs from './fs';
export * as git from './git';
export * as health from './health';
export * as http from './http';
export * as i18n from './i18n';
export * as launch from './launch';
export * as log from './log';
export * as notification from './notification';
export * as pkg from './pkg';
export * as platform from './platform';
export * as process from './process';
export * as profiles from './profiles';
export * as shell from './shell';
export * as ui from './ui';
export * as wsl from './wsl';

export * from './types';
export {
  buildInkAuthoringSnapshot,
  createHeadlessInkHarness,
  createInkAuthoringHostAdapter,
} from './ink';

/**
 * Convenience namespace: `import { cognia } from '@cognia/plugin-sdk';`
 * then call `cognia.env.detect("node")`, `cognia.log.info("msg")`, etc.
 */
import * as batch from './batch';
import * as cache from './cache';
import * as clipboard from './clipboard';
import * as config from './config';
import * as download from './download';
import * as env from './env';
import * as event from './event';
import * as fs from './fs';
import * as git from './git';
import * as health from './health';
import * as http from './http';
import * as i18n from './i18n';
import * as launch from './launch';
import * as log from './log';
import * as notification from './notification';
import * as pkg from './pkg';
import * as platform from './platform';
import * as process from './process';
import * as profiles from './profiles';
import * as shell from './shell';
import * as ui from './ui';
import * as wsl from './wsl';

export const cognia = {
  batch,
  cache,
  clipboard,
  config,
  download,
  env,
  event,
  fs,
  git,
  health,
  http,
  i18n,
  launch,
  log,
  notification,
  pkg,
  platform,
  process,
  profiles,
  shell,
  ui,
  wsl,
};

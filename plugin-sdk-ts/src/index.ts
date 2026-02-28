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

export * as clipboard from './clipboard';
export * as config from './config';
export * as env from './env';
export * as event from './event';
export * as fs from './fs';
export * as http from './http';
export * as i18n from './i18n';
export * as log from './log';
export * as notification from './notification';
export * as pkg from './pkg';
export * as platform from './platform';
export * as process from './process';
export * as ui from './ui';

export * from './types';

/**
 * Convenience namespace: `import { cognia } from '@cognia/plugin-sdk';`
 * then call `cognia.env.detect("node")`, `cognia.log.info("msg")`, etc.
 */
import * as clipboard from './clipboard';
import * as config from './config';
import * as env from './env';
import * as event from './event';
import * as fs from './fs';
import * as http from './http';
import * as i18n from './i18n';
import * as log from './log';
import * as notification from './notification';
import * as pkg from './pkg';
import * as platform from './platform';
import * as process from './process';
import * as ui from './ui';

export const cognia = {
  clipboard,
  config,
  env,
  event,
  fs,
  http,
  i18n,
  log,
  notification,
  pkg,
  platform,
  process,
  ui,
};

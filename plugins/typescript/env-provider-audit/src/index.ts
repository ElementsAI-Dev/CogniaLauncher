import { cognia } from '@cognia/plugin-sdk';

import {
  buildEnvProviderFailure,
  buildEnvProviderRecommendations,
  parseEnvProviderAuditInput,
  runEnvProviderAudit,
  summarizeEnvProviderIssues,
} from './core';

function env_provider_audit(): number {
  const raw = Host.inputString();
  try {
    const input = parseEnvProviderAuditInput(raw);
    const result = runEnvProviderAudit(input, cognia);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    Host.outputString(JSON.stringify(buildEnvProviderFailure(error)));
    return 1;
  }
}

declare const module: { exports: unknown };

module.exports = {
  env_provider_audit,
  __test: {
    parseInput: parseEnvProviderAuditInput,
    runAudit: (input: ReturnType<typeof parseEnvProviderAuditInput>) =>
      runEnvProviderAudit(input, cognia),
    summarizeIssues: summarizeEnvProviderIssues,
    buildRecommendations: buildEnvProviderRecommendations,
  },
};

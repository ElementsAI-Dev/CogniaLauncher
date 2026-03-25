import { cognia } from '@cognia/plugin-sdk';

import {
  buildPackageUpdateFailure,
  buildPackageUpdateRecommendations,
  buildPackageUpdateSummary,
  parsePackageUpdateAdvisorInput,
  runPackageUpdateAdvisor,
  selectTargetPackages,
} from './core';

function pkg_update_advisor(): number {
  const raw = Host.inputString();
  try {
    const input = parsePackageUpdateAdvisorInput(raw);
    const result = runPackageUpdateAdvisor(input, cognia);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    Host.outputString(JSON.stringify(buildPackageUpdateFailure(error)));
    return 1;
  }
}

declare const module: { exports: unknown };

module.exports = {
  pkg_update_advisor,
  __test: {
    parseInput: parsePackageUpdateAdvisorInput,
    runAdvisor: (input: ReturnType<typeof parsePackageUpdateAdvisorInput>) =>
      runPackageUpdateAdvisor(input, cognia),
    selectTargetPackages,
    buildSummary: buildPackageUpdateSummary,
    buildRecommendations: buildPackageUpdateRecommendations,
  },
};

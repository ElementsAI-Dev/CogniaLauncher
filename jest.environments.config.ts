import type { Config } from "jest";
import {
  baseJestConfig,
  createProjectJestConfig,
  createScopedCoverageReporters,
} from "./jest.shared.mts";

const environmentsConfig: Config = {
  ...baseJestConfig,
  collectCoverageFrom: [
    "app/environments/[envType]/page.tsx",
    "components/environments/detail/env-detail-settings.tsx",
    "hooks/use-environment-workflow.ts",
    "lib/environment-detection.ts",
    "lib/environment-workflow.ts",
    "lib/stores/environment.ts",
  ],
  coverageDirectory: "coverage/environments",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: createScopedCoverageReporters("environments"),
};

export default createProjectJestConfig(environmentsConfig);

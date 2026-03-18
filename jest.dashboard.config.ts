import type { Config } from "jest";
import {
  baseJestConfig,
  createProjectJestConfig,
  createScopedCoverageReporters,
} from "./jest.shared.mts";
const dashboardConfig: Config = {
  ...baseJestConfig,
  collectCoverageFrom: [
    "app/page.tsx",
    "components/dashboard/**/*.{js,jsx,ts,tsx}",
    "lib/stores/dashboard.ts",
    "!components/dashboard/**/*.test.{js,jsx,ts,tsx}",
  ],
  coverageDirectory: "coverage/dashboard",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: createScopedCoverageReporters("dashboard"),
};

export default createProjectJestConfig(dashboardConfig);

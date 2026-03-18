import type { Config } from "jest";
import {
  baseJestConfig,
  createProjectJestConfig,
  createScopedCoverageReporters,
} from "./jest.shared.mts";
const settingsConfig: Config = {
  ...baseJestConfig,
  collectCoverageFrom: [
    "app/settings/**/*.{js,jsx,ts,tsx}",
    "components/settings/**/*.{js,jsx,ts,tsx}",
    "hooks/use-settings.ts",
    "lib/settings/**/*.{js,jsx,ts,tsx}",
    "lib/stores/settings.ts",
    "!app/settings/**/*.test.{js,jsx,ts,tsx}",
    "!components/settings/**/*.test.{js,jsx,ts,tsx}",
    "!lib/settings/**/*.test.{js,jsx,ts,tsx}",
  ],
  coverageDirectory: "coverage/settings",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: createScopedCoverageReporters("settings"),
};

export default createProjectJestConfig(settingsConfig);

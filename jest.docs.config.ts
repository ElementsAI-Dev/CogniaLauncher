import type { Config } from "jest";
import {
  baseJestConfig,
  createProjectJestConfig,
  createScopedCoverageReporters,
} from "./jest.shared.mts";

const docsConfig: Config = {
  ...baseJestConfig,
  roots: [
    "<rootDir>/app/docs",
    "<rootDir>/components/docs",
    "<rootDir>/lib/docs",
  ],
  collectCoverageFrom: [
    "app/docs/**/*.{js,jsx,ts,tsx}",
    "components/docs/**/*.{js,jsx,ts,tsx}",
    "lib/docs/**/*.{js,jsx,ts,tsx}",
    "!app/docs/**/*.test.{js,jsx,ts,tsx}",
    "!components/docs/**/*.test.{js,jsx,ts,tsx}",
    "!lib/docs/**/*.test.{js,jsx,ts,tsx}",
    "!lib/docs/**/*.spec.{js,jsx,ts,tsx}",
    "!components/docs/index.ts",
  ],
  coverageDirectory: "coverage/docs",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: createScopedCoverageReporters("docs"),
};

export default createProjectJestConfig(docsConfig);

import type { Config } from "jest";
import {
  baseJestConfig,
  createProjectJestConfig,
  createScopedCoverageReporters,
} from "./jest.shared.mts";
const wslConfig: Config = {
  ...baseJestConfig,
  collectCoverageFrom: [
    "app/wsl/**/*.{js,jsx,ts,tsx}",
    "components/wsl/**/*.{js,jsx,ts,tsx}",
    "hooks/use-wsl.ts",
    "hooks/use-wsl-information.ts",
    "hooks/use-wsl-status.ts",
    "lib/wsl/**/*.{js,jsx,ts,tsx}",
    "lib/wsl.ts",
    "lib/stores/wsl.ts",
    "!app/wsl/**/*.test.{js,jsx,ts,tsx}",
    "!components/wsl/**/*.test.{js,jsx,ts,tsx}",
    "!lib/wsl/**/*.test.{js,jsx,ts,tsx}",
  ],
  coverageDirectory: "coverage/wsl",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: createScopedCoverageReporters("wsl"),
};

export default createProjectJestConfig(wslConfig);

import type { Config } from "jest";
import {
  baseJestConfig,
  createProjectJestConfig,
  createScopedCoverageReporters,
} from "./jest.shared.mts";
const wslConfig: Config = {
  ...baseJestConfig,
  collectCoverageFrom: [
    // Gate core WSL runtime/workflow contracts first; broader page/component
    // coverage remains tracked by dedicated WSL suites and OpenSpec tasks.
    "lib/wsl/**/*.{js,jsx,ts,tsx}",
    "lib/wsl.ts",
    "lib/stores/wsl.ts",
    "components/wsl/wsl-backup-card.tsx",
    "components/wsl/wsl-distro-docker.tsx",
    "components/wsl/wsl-batch-workflow-card.tsx",
    "!lib/wsl/**/*.test.{js,jsx,ts,tsx}",
  ],
  coverageDirectory: "coverage/wsl",
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
    "./lib/wsl/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "./lib/wsl.ts": {
      branches: 85,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./lib/stores/wsl.ts": {
      branches: 82,
      functions: 100,
      lines: 93,
      statements: 93,
    },
    "./components/wsl/wsl-backup-card.tsx": {
      branches: 75,
      functions: 54,
      lines: 75,
      statements: 75,
    },
    "./components/wsl/wsl-distro-docker.tsx": {
      branches: 68,
      functions: 71,
      lines: 80,
      statements: 80,
    },
    "./components/wsl/wsl-batch-workflow-card.tsx": {
      branches: 65,
      functions: 66,
      lines: 80,
      statements: 80,
    },
  },
  reporters: createScopedCoverageReporters("wsl"),
};

export default createProjectJestConfig(wslConfig);

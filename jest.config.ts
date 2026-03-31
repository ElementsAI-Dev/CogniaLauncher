import { baseJestConfig, createProjectJestConfig } from "./jest.shared.mts";

const baseCoverageThreshold = baseJestConfig.coverageThreshold ?? { global: {} };

export default createProjectJestConfig({
  ...baseJestConfig,
  coverageThreshold: {
    ...baseCoverageThreshold,
    global: baseCoverageThreshold.global ?? {},
    "./app/docs/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "./components/docs/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "./lib/docs/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
});

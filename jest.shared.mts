import type { Config } from "jest";

process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA = "true";
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";

const baselineMappingWarningPrefix =
  "[baseline-browser-mapping] The data in this module is over two months old.";
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].startsWith(baselineMappingWarningPrefix)
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

const { default: nextJest } = await import("next/jest.js");

const createNextJestConfig = nextJest({
  dir: "./",
});

export const junitReporterOptions = {
  outputName: "junit.xml",
  classNameTemplate: "{classname}",
  titleTemplate: "{title}",
  ancestorSeparator: " › ",
  usePathForSuiteName: true,
};

export function createScopedCoverageReporters(
  scope: string,
): Config["reporters"] {
  return [
    "default",
    [
      "jest-junit",
      {
        ...junitReporterOptions,
        outputDirectory: `coverage/${scope}`,
      },
    ],
  ];
}

export const baseJestConfig: Config = {
  clearMocks: true,
  collectCoverage: false,
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "components/**/*.{js,jsx,ts,tsx}",
    "hooks/**/*.{js,jsx,ts,tsx}",
    "lib/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/.next/**",
    "!**/coverage/**",
    "!**/out/**",
    "!lib/tauri.ts",
    "!**/index.ts",
  ],
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/out/",
    "/coverage/",
  ],
  coverageProvider: "v8",
  coverageReporters: [
    "json",
    "text",
    "lcov",
    "html",
    "clover",
    "cobertura",
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
    "./lib/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleFileExtensions: [
    "js",
    "mjs",
    "cjs",
    "jsx",
    "ts",
    "mts",
    "cts",
    "tsx",
    "json",
    "node",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^.+\\.module\\.(css|sass|scss)$": "identity-obj-proxy",
    "^.+\\.(css|sass|scss)$": "<rootDir>/__mocks__/styleMock.js",
    "^.+\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/i":
      "<rootDir>/__mocks__/fileMock.js",
  },
  modulePathIgnorePatterns: [
    "<rootDir>/out/",
    "<rootDir>/.next/",
  ],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        ...junitReporterOptions,
        outputDirectory: "coverage",
      },
    ],
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  forceExit: process.env.JEST_FORCE_EXIT === "true",
  testTimeout: 10000,
  testMatch: [
    "**/__tests__/**/*.?([mc])[jt]s?(x)",
    "**/?(*.)+(spec|test).?([mc])[jt]s?(x)",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/out/",
    "/src-tauri/",
    "/e2e/",
    "/plugin-sdk-ts/tests/",
  ],
};

export function createProjectJestConfig(config: Config) {
  return createNextJestConfig(config);
}

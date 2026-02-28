import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Jest coverage output:
    "coverage/**",
    // Tauri build output:
    "src-tauri/target/**",
    // Playwright E2E tests (not React code):
    "e2e/**",
    // Plugin SDK packages (standalone, own tsconfig):
    "plugin-sdk/**",
    "plugin-sdk-ts/**",
  ]),
]);

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["plugins/typescript/**/*.ts"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
  {
    files: ["plugins/typescript/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
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
    "src-tauri/target-*/**",
    "src-tauri/target-validation/**",
    // Playwright E2E tests (not React code):
    "e2e/**",
    // Plugin SDK packages (standalone, own tsconfig):
    "plugin-sdk/**",
    "plugin-sdk-ts/**",
  ]),
]);

export default eslintConfig;

---
description: Run and manage tests with coverage reporting, watch mode, and specific test targeting.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Parse Arguments**: Determine test scope from user input:
   - No arguments: Run all tests
   - File path: Run tests for specific file
   - `--watch`: Run in watch mode
   - `--coverage`: Generate coverage report
   - `--e2e`: Run Playwright E2E tests
   - `--update`: Update snapshots

2. **Check Test Environment**:
   - Verify `node_modules` exists
   - Check for required test dependencies (Jest, Playwright)
   - Ensure test configuration files exist

3. **Run Tests**: Execute appropriate test command:

   **Unit Tests (Jest)**:

   ```bash
   # All tests
   pnpm test
   
   # Specific file
   pnpm test <file-path>
   
   # Watch mode
   pnpm test:watch
   
   # Coverage
   pnpm test:coverage
   ```

   **E2E Tests (Playwright)**:

   ```bash
   # All E2E tests
   pnpm test:e2e
   
   # With UI
   pnpm test:e2e:ui
   ```

4. **Analyze Results**:
   - Parse test output for failures
   - Identify failing test files and line numbers
   - Extract error messages and stack traces

5. **Report Summary**:
   - Total tests: passed/failed/skipped
   - Coverage metrics (if applicable)
   - List of failing tests with file locations
   - Suggestions for fixing common issues

## Test File Conventions

- Unit tests: `*.test.ts` or `*.test.tsx` co-located with source
- E2E tests: `e2e/` directory organized by feature
- Mocks: `__mocks__/` directories for Tauri plugins

## Coverage Targets

- Lines: 70%
- Branches: 60%
- Excluded: `lib/search/`, `lib/vector/`, `lib/native/`

## Error Handling

- **Missing dependencies**: Run `pnpm install`
- **Test timeout**: Suggest increasing timeout or checking async operations
- **Mock issues**: Check `__mocks__/` directory for proper Tauri mocks
- **Snapshot failures**: Offer to update with `--update` flag

## Quick Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all unit tests |
| `pnpm test <file>` | Run single test file |
| `pnpm test:watch` | Watch mode |
| `pnpm test:coverage` | Coverage report |
| `pnpm test:e2e` | E2E tests |
| `pnpm test:e2e:ui` | E2E with Playwright UI |

## Notes

- Always run lint before testing to catch syntax errors
- Use `isTauri()` guard in tests that require desktop environment
- Mock external APIs and services in unit tests
- Keep E2E tests focused on critical user flows

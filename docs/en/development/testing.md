# Testing Guide

CogniaLauncher uses Jest 30 + Testing Library for frontend testing, and Rust's built-in test framework for backend testing.

---

## Frontend Testing

### Test Stack

| Tool | Purpose |
|------|---------|
| Jest 30 | Test runner |
| @testing-library/react | Component testing |
| @testing-library/jest-dom | DOM assertion extensions |
| jest-environment-jsdom | Browser simulation environment |

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Run specific file
pnpm test -- --testPathPattern="environment-list"
```

### File Organization

Test files are co-located with source files:

```text
components/
├── dashboard/
│   ├── environment-list.tsx        # Component
│   └── environment-list.test.tsx   # Test
hooks/
├── use-environments.ts             # Hook
└── use-environments.test.ts        # Test
lib/
└── __tests__/
    └── utils.test.ts               # Utility function tests
```

### Component Test Example

```tsx
import { render, screen } from "@testing-library/react";
import { EnvironmentList } from "./environment-list";

describe("EnvironmentList", () => {
  it("renders environment items", () => {
    render(
      <EnvironmentList
        environments={[
          { name: "Node.js", version: "20.11.0", type: "nodejs" },
        ]}
      />
    );
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("20.11.0")).toBeInTheDocument();
  });
});
```

### Mock Strategy

- **Tauri API**: Mock via `jest.mock("@tauri-apps/api")`
- **Zustand Store**: Mock via `jest.mock("@/lib/stores/xxx")`
- **next-intl**: Use custom mock that returns key names
- **Static assets**: Via `__mocks__/fileMock.js` and `styleMock.js`

---

## Backend Testing

### Rust Unit Tests

```bash
# Run all tests
cargo test

# Run specific module tests
cargo test winget
cargo test sdkman

# With output
cargo test -- --nocapture
```

### Test Example

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_output() {
        let output = "package-name  1.0.0  description";
        let result = parse_search_output(output);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "package-name");
    }

    #[test]
    fn test_provider_capabilities() {
        let provider = MyProvider::new();
        assert!(provider.capabilities().contains(&Capability::Install));
    }
}
```

---

## Coverage

### Frontend Coverage

```bash
pnpm test:coverage
```

Output reports to `coverage/` directory, including:

- Line coverage
- Branch coverage
- Function coverage
- File-level details

### Priority Test Targets

1. `lib/` utility functions — Pure logic, easy to test
2. Custom Hooks — Core business logic
3. Complex UI components — Components with interaction logic
4. Rust Provider parse functions — Output parsing is error-prone

---

## CI Integration

Tests run automatically in GitHub Actions:

- **Every Push** triggers lint + test
- **PR** triggers the full test suite
- Test results and coverage reports uploaded as Artifacts

See [CI/CD](ci-cd.md) for details.

---

## E2E Testing

### Test Stack

| Tool | Purpose |
|------|---------|
| Playwright 1.58+ | E2E test framework |
| Chromium | Default browser |

### Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with Playwright UI
pnpm test:e2e:ui

# Headed mode (observe the browser)
pnpm test:e2e:headed

# Run specific file only
pnpm test:e2e -- e2e/navigation.spec.ts
```

### File Organization

E2E test files are located in the `e2e/` directory:

```text
e2e/
├── fixtures/
│   └── app-fixture.ts      # Shared fixture (wait for app ready, selectors)
├── navigation.spec.ts      # Sidebar navigation, breadcrumbs, routing
├── dashboard.spec.ts       # Dashboard page
├── environments.spec.ts    # Environment management page
├── packages.spec.ts        # Package management page
├── providers.spec.ts       # Providers page
├── cache.spec.ts           # Cache page (overview + sub-routes)
├── downloads.spec.ts       # Download management page
├── git.spec.ts             # Git page (Web fallback)
├── wsl.spec.ts             # WSL page (Web fallback)
├── logs.spec.ts            # Logs page
├── settings.spec.ts        # Settings page
├── about.spec.ts           # About page
├── docs.spec.ts            # Documentation viewer
├── theme-locale.spec.ts    # Theme/language switching
├── keyboard.spec.ts        # Shortcuts and command palette
├── responsive.spec.ts      # Responsive layout
└── error-handling.spec.ts  # Error/404 pages
```

### Notes

- E2E tests run in Web mode (`pnpm dev`), no Tauri desktop dependency
- Desktop-only features (WSL, Git management, etc.) test their fallback state in Web mode
- Configuration file: `playwright.config.ts` (project root)

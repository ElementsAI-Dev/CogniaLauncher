# CI/CD

CogniaLauncher uses GitHub Actions for continuous integration and deployment.

---

## Workflow Overview

| Job | Trigger | Function |
|-----|---------|----------|
| Code Quality & Security | Push, PR | ESLint + security checks |
| Test Suite | Push, PR | Jest tests + coverage |
| Deploy Preview | PR | Vercel preview deployment |
| Deploy Production | Push to main | Vercel production deployment |
| Build Tauri | Tag (v*) | Build desktop application |
| Create Release | Tag (v*) | Create GitHub Release |

---

## Trigger Rules

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  release:
    types: [created]
```

---

## Job Details

### Code Quality & Security

- Run `pnpm lint`
- Check dependency security vulnerabilities
- TypeScript type checking

### Test Suite

- Run `pnpm test`
- Generate coverage report
- Upload test results as Artifacts

### Deploy Preview

- Automatically deploy preview on PR creation
- Preview URL provided in PR comments

### Build Tauri

- Multi-platform build: Windows (x64), macOS (x64/ARM64), Linux (x86_64)
- Output: MSI, DMG, AppImage, .deb
- Upload build artifacts as Artifacts

### Create Release

- Triggered from Tag
- Collect all platform build artifacts
- Create GitHub Release with attached binaries

---

## Cache Strategy

| Cache | Key | Purpose |
|-------|-----|---------|
| pnpm store | `pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}` | Node dependencies |
| Cargo | `cargo-${{ hashFiles('Cargo.lock') }}` | Rust dependencies |
| Next.js | `.next/cache` | Build cache |

---

## Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Duplicate workflows on the same branch automatically cancel the older run.

---

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Vercel deployment |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `TAURI_PRIVATE_KEY` | Tauri updater signing key |
| `TAURI_KEY_PASSWORD` | Signing key password |

---

## Local Verification

Run locally before submitting a PR:

```bash
# Frontend
pnpm lint
pnpm test

# Backend
cargo check
cargo test

# Build verification
pnpm build
```

---

## Troubleshooting

### Common CI Failure Causes

1. **Lint failure** — Run `pnpm lint --fix` to fix
2. **Test failure** — Check if `pnpm test` passes locally
3. **Type error** — Ensure `pnpm build` succeeds locally
4. **Cargo compilation failure** — Run `cargo check` to check
5. **Dependency mismatch** — Delete `node_modules` and re-run `pnpm install`

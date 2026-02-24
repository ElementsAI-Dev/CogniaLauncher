<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Repository Guidelines

## Project Structure & Module Organization

- `app/` Next.js App Router (routes: `page.tsx`, `layout.tsx`, global styles in `globals.css`).
- `components/ui/` Reusable UI components (shadcn patterns), e.g., `components/ui/button.tsx`.
- `lib/` Shared utilities (e.g., `lib/utils.ts`).
- `public/` Static assets (SVGs, icons).
- `src-tauri/` Tauri desktop wrapper (Rust code, config, icons).
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`.

## Build, Test, and Development Commands

- `pnpm dev` — Run Next.js in development.
- `pnpm build` — Create a production build.
- `pnpm start` — Serve the production build.
- `pnpm lint` — Run ESLint. Use `--fix` to auto-fix.
- `pnpm test:e2e` — Run Playwright E2E tests.
- `pnpm test:e2e:ui` — Run E2E tests with Playwright UI.
- `pnpm tauri dev` — Launch desktop app (requires Rust toolchain).
- `pnpm tauri build` — Build desktop binaries.

## Coding Style & Naming Conventions

- Language: TypeScript with React 19 and Next.js 16.
- Linting: `eslint.config.mjs` is the source of truth; keep code warning-free.
- Styling: Tailwind CSS v4 (utility-first). Co-locate minimal component-specific styles.
- Components: PascalCase names/exports; files in `components/ui/` mirror export names.
- Routes: Next app files are lowercase (`page.tsx`, `layout.tsx`).
- Code: camelCase variables/functions; hooks start with `use*`.

## Testing Guidelines

- **Test Runner**: Jest 30 with jest-environment-jsdom and @testing-library/react.
- Name tests `*.test.ts`/`*.test.tsx`; co-locate next to source or in `tests/`.
- Run: pnpm test (all), pnpm test:watch (watch), pnpm test:coverage (coverage).

- Coverage thresholds: branches 60%, functions 60%, lines 70%, statements 70%.
- **Rust tests**: cargo test in src-tauri/ (270+ provider unit tests).
- See docs/development/testing.md for detailed testing guide and best practices.

## Commit & Pull Request Guidelines

- Prefer Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`.
- Link issues in the footer: `Closes #123`.
- PRs should include: brief scope/intent, screenshots for UI changes, validation steps, and pass `pnpm lint`.
- Keep changes focused; avoid unrelated refactors.

## Security & Configuration Tips

- Use `.env.local` for secrets; do not commit `.env*` files.
- Only expose safe client values via `NEXT_PUBLIC_*`.
- Tauri: minimize capabilities in `src-tauri/tauri.conf.json`; avoid broad filesystem access.

# Environment Management Audit Matrix

This matrix is the regression baseline for environment management.
It defines the capability map, verification matrix, and the targeted
coverage scope used by the `improve-environment-management-completeness-and-tests`
OpenSpec change.

Notes:
- The goal is end-to-end completeness, not isolated file coverage.
- `lib/tauri.ts` remains protected primarily by invoke contract tests rather than
  direct coverage thresholds because it is an IPC wrapper surface.
- Rows below list the primary ownership layer and the main regression checks that
  must keep passing.

## Capability Map

| Module Group | Primary Files | Responsibility | Critical Invariants |
|---|---|---|---|
| Rust environment core | `src-tauri/src/core/environment.rs` | Canonical environment list/get/install/detect orchestration and provider resolution | Logical env type normalization stays stable; provider-aware rows do not collapse; verification results preserve post-mutation meaning |
| Rust project detection | `src-tauri/src/core/project_env_detect.rs` | Detection source ordering, parsing, default-enabled source lists | Backend remains the authority for detection source order/defaults; source priority is deterministic |
| Rust Tauri commands | `src-tauri/src/commands/environment.rs` | IPC contract for environment list, install, uninstall, detect, settings, providers, updates, cleanup | Command names/params/results remain stable; cache invalidation happens after successful mutations |
| TypeScript Tauri bridge | `lib/tauri.ts` | Frontend invoke wrappers and payload shaping | Wrapper command names and payload keys match Rust commands exactly |
| Shared TS types | `types/tauri.ts` | Frontend type contract for Rust payloads | Snake_case vs camelCase semantics stay aligned with Rust serialization rules |
| Environment store | `lib/stores/environment.ts` | Persisted UI state for env settings, provider selection, workflow state, filters | Logical env settings keys resolve consistently; provider-scoped rows do not overwrite each other |
| Environment orchestration hook | `hooks/use-environments.ts` | Fetching, stale-while-revalidate, in-flight de-dupe, mutation reconciliation, detection-source fallback | Cache behavior is deterministic; mutation flows reconcile environment/detection/provider state consistently |
| Environment workflow helpers | `lib/environment-workflow.ts`, `hooks/use-environment-workflow.ts` | Workflow context, provider selection continuity, blocked/running/success state | Workflow context survives cross-surface transitions; stale provider selections are normalized predictably |
| Detection helpers | `lib/environment-detection.ts`, `hooks/use-environment-detection.ts` | Mapping detected versions to UI surfaces | Provider-aware detected results stay attributable to the correct logical environment |
| Environment pages | `app/environments/page.tsx`, `app/environments/[envType]/page.tsx` | Overview page and detail route composition | Desktop fallback stays explicit; provider selection and project path context remain consistent |
| Environment components | `components/environments/**/*.tsx` | Cards, detail panels, version browser, profile manager, workflow banner, health and update surfaces | User-visible actions reflect the same underlying provider/settings/workflow state across surfaces |
| Test matrix | `lib/*.test.ts`, `hooks/*.test.ts`, `app/environments/*.test.tsx`, `components/environments/*.test.tsx`, Rust unit tests | Regression protection for all layers above | Each module group has at least one focused automated assertion |

## Verification Matrix

| Module Group | Critical Behaviors (must stay working) | Primary Automated Validation |
|---|---|---|
| Rust environment core | Provider-aware list rows, version verification semantics, detection result shaping | `src-tauri/src/core/environment.rs` unit tests |
| Rust project detection | Default detection sources, default-enabled source set, source priority ordering | `src-tauri/src/core/project_env_detect.rs` unit tests |
| Rust Tauri commands | `env_list`, `env_install`, `env_uninstall`, `env_detect_all`, `env_save_settings`, `env_load_settings`, detection source commands, provider list commands | Rust command tests where behavior changes; TS invoke contract tests for command wiring |
| TypeScript Tauri bridge | Invoke command names and payload keys stay aligned with Rust command signatures | `lib/tauri.test.ts` |
| Shared TS types | Serialized result fields remain correctly typed and named for frontend consumers | `lib/tauri.test.ts` plus compile-time usage in `hooks/use-environments.ts` |
| Environment store | Provider selection persistence, logical env type resolution, settings key migration/overwrite rules, workflow state writes | `lib/stores/environment.test.ts` |
| Environment orchestration hook | In-flight request de-dupe, detection source fallback, settings load/save normalization, reconcile/invalidation consistency | `hooks/use-environments.test.ts` |
| Environment workflow helpers | Selected provider continuity, workflow state reuse, blocked-state normalization | `lib/environment-workflow.test.ts`, `hooks/use-environment-workflow.test.ts` |
| Detection helpers | Mapping detected versions back to env/provider surfaces | `lib/environment-detection.test.ts`, `hooks/use-environment-detection.test.ts` |
| Environment overview route | Desktop-only fallback, initial fetch behavior, provider continuity, refresh wiring | `app/environments/page.test.tsx` |
| Environment detail route | Surface composition for selected provider/environment and route fallback behavior | `app/environments/[envType]/page.test.tsx` |
| Environment components | Settings save flows, detail panel refresh, workflow banner state, card actions, profile visibility, health/update summaries | `components/environments/**/*.test.tsx` |

## Coverage Scope (90% Gate)

The targeted environment-management coverage gate should measure these files:

- `app/environments/**/*.{ts,tsx}`
- `components/environments/**/*.{ts,tsx}`
- `hooks/use-environments.ts`
- `hooks/use-environment-detection.ts`
- `hooks/use-environment-workflow.ts`
- `lib/stores/environment.ts`
- `lib/environment-detection.ts`
- `lib/environment-workflow.ts`

Explicit exclusions:

- `lib/tauri.ts`
  Reason: wrapper correctness is guarded through invoke contract tests rather than direct line coverage.
- Test files, `*.d.ts`, and barrel-only `index.ts` files
  Reason: they do not represent production behavior worth gating directly.

## Known Priority Gaps To Close

These are the highest-value areas for this OpenSpec change:

1. Environment IPC contract coverage in `lib/tauri.test.ts`
2. Provider-selection and logical-env-type persistence edge cases in `lib/stores/environment.test.ts`
3. Reconciliation and detection-source fallback edge cases in `hooks/use-environments.test.ts`
4. Cross-surface provider continuity and desktop fallback assertions in `app/environments/*.test.tsx`
5. CI enforcement for `cargo test --manifest-path src-tauri/Cargo.toml`


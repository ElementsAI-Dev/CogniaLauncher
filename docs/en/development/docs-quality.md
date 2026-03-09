# Documentation Quality & Sync

This page defines the baseline policy for keeping English and Chinese documentation consistent and verifiable.

## Required EN/ZH Core Page Parity Map

The following core pages MUST exist in both `docs/en` and `docs/zh`:

| Section | English Path | Chinese Path |
|---------|--------------|--------------|
| Home | `docs/en/index.md` | `docs/zh/index.md` |
| Getting Started | `docs/en/getting-started/index.md` | `docs/zh/getting-started/index.md` |
| Guide | `docs/en/guide/index.md` | `docs/zh/guide/index.md` |
| Development | `docs/en/development/index.md` | `docs/zh/development/index.md` |
| Architecture | `docs/en/architecture/index.md` | `docs/zh/architecture/index.md` |
| Reference | `docs/en/reference/index.md` | `docs/zh/reference/index.md` |
| Design | `docs/en/design/index.md` | `docs/zh/design/index.md` |
| Appendix | `docs/en/appendix/index.md` | `docs/zh/appendix/index.md` |

## Baseline Exceptions

- Current baseline exceptions: **none**.
- If an exception is needed, document it in the same PR with:
  - reason,
  - target removal date, and
  - owner.

## Ownership Rules

- Feature owners are responsible for updating affected docs in both language trees.
- Reviewers verify docs impact declarations and no-doc-impact justifications.
- CI runs documentation validation in warning mode during rollout, and will transition to enforce mode after baseline stability.

## Capability Coverage Matrix

The repository MUST keep `docs/documentation-coverage-matrix.json` current for required user-facing and workflow-facing capabilities.

Each capability mapping MUST include:

- `id`: stable kebab-case capability identifier.
- `owner`: owning team or area.
- `enPages`: required English docs paths.
- `zhPages`: required Chinese docs paths.

Capability selection criteria:

- Add or update a capability when a feature changes user-visible behavior or developer workflow.
- Add or update a capability when command usage, setup steps, or troubleshooting flow changes.
- Keep capability boundaries outcome-focused (what users/developers do), not implementation-focused.

Maintenance rules:

- If a feature PR updates mapped docs paths, update matrix entries in the same PR.
- If a feature PR claims no docs impact, include reviewed capability IDs and concrete rationale.
- Validation must fail when required capability mappings are missing or unresolved.

## Validation Commands

Run these checks before opening a PR:

```bash
pnpm docs:validate
```

For non-blocking rollout checks (used in CI during migration):

```bash
pnpm docs:validate:warn
```

## Docs Impact Review Gate

A user-facing or workflow-facing change MUST include one of the following:

1. Documentation updates in the same PR, or
2. A no-doc-impact statement with concrete justification and reviewed capability IDs from `docs/documentation-coverage-matrix.json`.

## Requirement Coverage Mapping

| Spec Requirement | Implementation Check / Gate |
|------------------|-----------------------------|
| Bilingual documentation parity for core sections | `pnpm docs:validate` parity check (`requiredCorePages`) |
| Documentation links and references are valid | `pnpm docs:validate` internal link + anchor validation |
| Documentation command examples are verifiable | `pnpm docs:validate` shell command policy checks |
| Capability-to-doc coverage matrix is maintained | `pnpm docs:validate` coverage matrix structure + required capability checks (`docs/documentation-coverage-matrix.json`) |
| Capability mappings reference resolvable docs pages | `pnpm docs:validate` mapped path existence checks for EN/ZH pages |
| Documentation impact review is enforced for feature changes | `.github/pull_request_template.md` docs impact checklist + reviewer justification requirement |

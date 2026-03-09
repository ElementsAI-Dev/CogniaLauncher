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
2. A no-doc-impact statement with concrete justification.

## Requirement Coverage Mapping

| Spec Requirement | Implementation Check / Gate |
|------------------|-----------------------------|
| Bilingual documentation parity for core sections | `pnpm docs:validate` parity check (`requiredCorePages`) |
| Documentation links and references are valid | `pnpm docs:validate` internal link + anchor validation |
| Documentation command examples are verifiable | `pnpm docs:validate` shell command policy checks |
| Documentation impact review is enforced for feature changes | `.github/pull_request_template.md` docs impact checklist + reviewer justification requirement |

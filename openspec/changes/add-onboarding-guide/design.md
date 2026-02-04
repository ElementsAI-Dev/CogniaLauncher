# Design: Onboarding Guide

## Context

CogniaLauncher currently ships without a first-run onboarding experience. The UI exposes multiple complex areas (environments, packages, settings) without a guided entry point. The project already uses Zustand, shadcn/ui, and a custom locale provider.

## Goals / Non-Goals

- Goals:
  - Provide a first-run wizard that guides essential setup and discovery.
  - Persist onboarding progress and completion state across sessions.
  - Provide an optional guided tour for primary navigation.
  - Allow users to re-run onboarding from Settings.
- Non-Goals:
  - Replace the existing settings system or environment management flows.
  - Introduce new UI dependencies beyond existing shadcn/ui and Radix primitives.

## Decisions

- Use a new Zustand store (persisted to localStorage) to track onboarding state, step progress, and completion.
- Build the wizard with existing shadcn/ui components (Dialog, Tabs, Progress, Button, Card) to match the design system.
- Use the existing LocaleProvider to resolve onboarding strings via messages/en.json and messages/zh.json.
- Implement a lightweight guided tour layer with existing Tooltip/Popover-style UI instead of a new dependency.

## Risks / Trade-offs

- Additional state persistence keys can conflict with future onboarding versions → include versioning and reset capability.
- Guided tour overlays may compete with existing layouts → keep tour steps minimal and optional.

## Migration Plan

1. Add onboarding store and hook.
2. Add wizard and tour UI.
3. Integrate into AppShell and Settings.
4. Add i18n and tests.

## Open Questions

- Which settings page section should host the re-run action (General vs Appearance)?
- Should onboarding auto-start in web-only mode or only in Tauri desktop mode?

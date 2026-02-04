# Change: Add onboarding guide and tour

## Why

New users currently land in the main UI without guidance, which makes core actions (environment setup, mirror configuration, shell initialization) hard to discover. A structured onboarding flow and optional guided tour will improve first-run success and reduce confusion.

## What Changes

- Add a first-run onboarding wizard covering language, theme, environment detection, mirror configuration, and shell initialization guidance.
- Add an optional guided tour highlighting core navigation and key pages.
- Persist onboarding progress and completion state, with a Settings entry to re-run or reset onboarding.
- Add i18n strings and unit tests for onboarding state, hook behavior, and core UI.

## Impact

- Affected specs: ui-interface
- Affected code: lib/stores, lib/hooks, components/onboarding, components/providers, app/layout, app/settings, messages/*.json

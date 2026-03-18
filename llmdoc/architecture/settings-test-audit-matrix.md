# Settings Test Audit Matrix

## Purpose

Maintain a single place that maps every Settings surface to its owning tests and critical workflows so behavior changes cannot bypass regression coverage.

## Page And Orchestration

| Area | Source | Owning Tests | Critical Workflows |
| --- | --- | --- | --- |
| Settings page | `app/settings/page.tsx` | `app/settings/page.test.tsx` | draft preservation, save/retry, import/export, reset, shortcuts, mobile navigation, appearance preset orchestration |
| Settings bridge hook | `hooks/use-settings.ts` | `hooks/use-settings.test.ts` | config fetch/set/reset, appearance normalization, runtime sync, cache/platform fetch, error fallback |
| Settings store | `lib/stores/settings.ts` | `lib/stores/settings.test.ts` | persisted defaults, partial app-settings merge, migration-safe state shape |

## Settings Mapping And Validation

| Area | Source | Owning Tests | Critical Workflows |
| --- | --- | --- | --- |
| App settings mapping | `lib/settings/app-settings-mapping.ts` | `lib/settings/app-settings-mapping.test.ts` | config-to-app mapping, app-to-config entries, legacy localStorage migration |
| Import validation | `lib/settings/import-validation.ts` | `lib/settings/import-validation.test.ts` | schema validation, diff summary, invalid payload rejection |
| Reset mapping | `lib/settings/reset-mapping.ts` | `lib/settings/reset-mapping.test.ts` | section reset, app settings rebuild, validation error cleanup |
| Section utilities | `lib/settings/section-utils.ts` | `lib/settings/section-utils.test.ts` | key-to-section routing, section ownership helpers |

## Section Components

| Area | Source | Owning Tests | Critical Workflows |
| --- | --- | --- | --- |
| General | `components/settings/general-settings.tsx` | `components/settings/general-settings.test.tsx` | numeric defaults, validation display, toggle updates |
| Network | `components/settings/network-settings.tsx` | `components/settings/network-settings.test.tsx` | numeric/text field updates, validation errors, web/desktop gating, proxy tool actions/results |
| Security | `components/settings/security-settings.tsx` | `components/settings/security-settings.test.tsx` | TLS/HTTP toggles, validation states |
| Mirrors | `components/settings/mirrors-settings.tsx` | `components/settings/mirrors-settings.test.tsx` | registry fields, mirror toggle/priority semantics |
| Appearance controls | `components/settings/appearance-settings.tsx` | `components/settings/appearance-settings.test.tsx` | theme/language/accent/reduced-motion/background controls, Tauri-only affordances |
| Appearance workbench | `components/settings/appearance-workbench.tsx` | `components/settings/appearance-workbench.test.tsx` | preset selection, apply/save/rename/delete, reset, divergence badge |
| Update | `components/settings/update-settings.tsx` | `components/settings/update-settings.test.tsx` | update source mode, custom endpoints, fallback toggle |
| Tray | `components/settings/tray-settings.tsx` | `components/settings/tray-settings.test.tsx` | tray toggles, app-settings integration |
| Tray menu customization | `components/settings/tray-menu-customizer.tsx` | `components/settings/tray-menu-customizer.test.tsx` | ordering, item enablement, drag/drop shell behavior |
| Sidebar order | `components/settings/sidebar-order-customizer.tsx` | `components/settings/sidebar-order-customizer.test.tsx` | primary/secondary ordering, boundary disablement, reset |
| Paths | `components/settings/paths-settings.tsx` | `components/settings/paths-settings.test.tsx` | path input validation, browse/manual fallback, external errors |
| Provider | `components/settings/provider-settings.tsx` | `components/settings/provider-settings.test.tsx` | provider normalization, enabled/priority editing |
| Backup policy | `components/settings/backup-policy-settings.tsx` | `components/settings/backup-policy-settings.test.tsx` | backup cadence and retention controls |
| Backup operations | `components/settings/backup-settings.tsx` | `components/settings/backup-settings.test.tsx` | backup CTA visibility and action states |
| Startup | `components/settings/startup-settings.tsx` | `components/settings/startup-settings.test.tsx` | scan toggles, numeric defaults, validation errors |
| Shortcuts | `components/settings/shortcut-settings.tsx` | `components/settings/shortcut-settings.test.tsx` | desktop-only gating, record/reset flows |
| System information | `components/settings/system-info.tsx` | `components/settings/system-info.test.tsx` | platform display, fallback states |

## Shared Settings UI

| Area | Source | Owning Tests | Critical Workflows |
| --- | --- | --- | --- |
| Setting primitives | `components/settings/setting-item.tsx` | `components/settings/setting-item.test.tsx` | label/description linkage, input/switch/select/slider semantics, error display |
| Search | `components/settings/settings-search.tsx` | `components/settings/settings-search.test.tsx` | search filtering, navigation affordances |
| Navigation | `components/settings/settings-nav.tsx` | `components/settings/settings-nav.test.tsx` | section discovery, change badges, active section highlighting |
| Collapsible shell | `components/settings/collapsible-section.tsx` | `components/settings/collapsible-section.test.tsx` | open/close, reset affordance, heading semantics |
| Accent picker | `components/settings/accent-color-picker.tsx` | `components/settings/accent-color-picker.test.tsx` | option selection, tooltip/state semantics |
| Background settings | `components/settings/background-settings.tsx` | `components/settings/background-settings.test.tsx` | preview shell, action gating, reset/import controls |
| Skeleton | `components/settings/settings-skeleton.tsx` | `components/settings/settings-skeleton.test.tsx` | loading placeholder structure |

## Maintenance Rules

- Any Settings behavior change MUST update this matrix in the same change if source files or workflow ownership move.
- Any newly added `components/settings/*.tsx` file MUST ship with a matching `*.test.tsx` file before the change is complete.
- Desktop-only behavior MUST be covered by an explicit web fallback assertion and a desktop-enabled assertion when the component exposes both states.

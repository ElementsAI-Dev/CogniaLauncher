# E2E Coverage Matrix

## Audit Summary (Task 1.1)

Current route surface from `app/**` and sidebar navigation:

- `/` (dashboard)
- `/environments`
- `/health`
- `/packages`
- `/providers`
- `/cache`
- `/downloads`
- `/git`
- `/envvar`
- `/terminal`
- `/toolbox`
- `/wsl`
- `/logs`
- `/docs`
- `/settings`
- `/about`

Audit findings before this change:

- Missing dedicated coverage: `/toolbox`, `/health`.
- Weak/mostly-smoke coverage: `/docs`, `/downloads`, `/providers` (render-first assertions, limited behavior + resilience checks).
- Navigation coverage did not include latest sidebar paths for `Toolbox` and nested `Health Report`.

## Route-Flow Coverage Matrix (Task 1.2)

| Route | Owning Spec | Behavior Scenario | Resilience Scenario |
| --- | --- | --- | --- |
| `/` | `e2e/dashboard.spec.ts` | Enter/exit edit mode and open customize dialog | Dashboard remains interactive without runtime data |
| `/environments` | `e2e/environments.spec.ts` | Verify desktop-required fallback guidance in web mode | Desktop-only actions are hidden and route remains stable |
| `/health` | `e2e/health.spec.ts` | Navigate to route from sidebar environments section | Desktop-only fallback shown in web mode, no error overlay |
| `/packages` | `e2e/packages.spec.ts` | Desktop-only fallback guidance is rendered in web mode | No crash and no fatal overlay without Tauri backend |
| `/providers` | `e2e/providers.spec.ts` | Search/filter/view mode interaction | No crash and stable toolbar state in web mode |
| `/cache` (+subroutes) | `e2e/cache.spec.ts` | Navigate sub-routes from cache route family | All sub-routes render `main` without fatal errors |
| `/downloads` | `e2e/downloads.spec.ts` | Switch queue/history tabs | Desktop-only queue actions hidden in web mode |
| `/git` | `e2e/git.spec.ts` | Route loads with Git header/fallback shell | Desktop-only runtime UI replaced by web fallback |
| `/envvar` | `e2e/envvar.spec.ts` | Route title and fallback shell visible | Desktop-only envvar tabs hidden in web mode |
| `/terminal` | `e2e/terminal.spec.ts` | Tab switching across terminal sections | Route remains functional without Tauri runtime |
| `/toolbox` | `e2e/toolbox.spec.ts` | Search/view/category interactions | Empty-state recovery via clear-search action |
| `/wsl` | `e2e/wsl.spec.ts` | Route title and fallback shell visible | Desktop-only runtime actions hidden in web mode |
| `/logs` | `e2e/logs.spec.ts` | Realtime/files tab and export/filter interactions | Desktop-only file actions absent in web mode |
| `/docs` | `e2e/docs.spec.ts` | Navigate docs index and open docs navigation control | Missing route renders 404 and docs page stays stable |
| `/settings` | `e2e/settings.spec.ts` | Search + section expand/collapse + export affordance | No crash from keyboard shortcut/section interactions |
| `/about` | `e2e/about.spec.ts` | Open changelog/diagnostics actions card controls | About route remains stable when runtime APIs are absent |

## Desktop-Only Web Fallback Expectations (Task 1.3)

In web-mode E2E (`isTauri() === false`), desktop-only routes MUST satisfy:

- `Git` (`/git`): show fallback shell and keep desktop runtime controls unavailable.
- `WSL` (`/wsl`): hide desktop runtime actions/tabs and show safe fallback state.
- `Health` (`/health`): show `Desktop App Required` guidance; desktop health actions are not rendered.
- `Envvar` (`/envvar`): desktop editor tabs are not rendered.
- `Logs` desktop-only file operations remain unavailable while realtime tab remains usable.

These expectations are validated in route-specific specs and treated as regression gates.

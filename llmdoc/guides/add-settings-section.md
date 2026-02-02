# How to Add a Settings Section

1. **Create component** in `components/settings/{section}-settings.tsx` matching the interface pattern in `components/settings/general-settings.tsx`.

2. **Define validation** in the component or extract to shared validator function used by `app/settings/page.tsx:82-84`.

3. **Register component** in `components/settings/index.ts` and import in `app/settings/page.tsx:22-32`.

4. **Render in page** by adding component to the settings page render section around `app/settings/page.tsx:332-374`.

5. **Add i18n keys** to `messages/en.json` and `messages/zh.json` for labels, descriptions, and validation messages.

6. **Verify** by running `pnpm dev` and testing the settings section loads, validates, and saves correctly.

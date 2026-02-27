# Contributing Guide

## Code Style

### TypeScript / React

- **ESLint** is the authoritative source for code style (`eslint.config.mjs`)
- Components use **PascalCase** naming and exports
- Files use **kebab-case** naming
- Variables and functions use **camelCase**
- Hooks start with `use`
- Styles use Tailwind CSS utility classes
- Class name merging uses the `cn()` utility function

### Rust

- Follow standard Rust naming conventions
- Check with `cargo clippy`
- Error handling uses `CogniaResult<T>` uniformly
- Provider implementations follow trait interfaces

### Import Conventions

- Use `@/` path aliases
- Import statements at the top of the file
- Group by type: external libraries → internal modules → types

---

## Commit Conventions

Use **Conventional Commits**:

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation update |
| `refactor` | Code refactoring |
| `chore` | Build/tool changes |
| `ci` | CI/CD changes |
| `test` | Test related |
| `style` | Code formatting (no logic changes) |
| `perf` | Performance optimization |

### Example

```text
feat(provider): add xmake/xrepo C++ package manager

- Implement XmakeProvider with search/install/uninstall/list
- Add xrepo info parsing for package details
- Register in provider registry after conan

Closes #42
```

---

## PR Process

1. Fork the repository and create a feature branch
2. Develop on the branch, keep commits atomic
3. Ensure `pnpm lint` and `pnpm test` pass
4. Backend changes must pass `cargo check`
5. Submit a PR including:
   - Brief description of change scope and intent
   - Screenshots for UI changes
   - Validation steps
6. Wait for code review

---

## i18n Conventions

When adding new user-visible text:

1. Add corresponding keys in both `messages/en.json` and `messages/zh.json`
2. Keep both files' keys perfectly synced (currently 1640+ keys)
3. Use nested structure to organize key names
4. Use `useTranslations()` in components to get translations

---

## Security Notes

- Do not hardcode secrets or tokens in code
- Use `.env.local` to store local development keys
- Minimize permission declarations in Tauri configuration
- Do not output sensitive information in logs

---
description: Execute project commit workflow with detailed conventional commit messages, including lint checks, fix issues, and generate comprehensive commit messages.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Check Git Status**: Run `git status --short` to see all modified, added, and untracked files.

2. **Run Lint Check**: Execute `pnpm lint` to identify code style issues.
   - If lint errors exist, attempt to fix with `pnpm lint --fix`
   - Report any remaining issues that need manual intervention

3. **Run Type Check**: Execute `pnpm tsc --noEmit` to verify TypeScript types.
   - Report any type errors found
   - Suggest fixes for common type issues

4. **Analyze Changes**: For each changed file:
   - Identify the type of change (feat, fix, refactor, test, docs, style, chore)
   - Determine the scope (component name, module, feature area)
   - Summarize what was changed and why

5. **Generate Commit Message**: Create a detailed conventional commit message following this format:

   ```
   <type>(<scope>): <subject>

   <body>

   <footer>
   ```

   **Type Categories**:
   - `feat`: New feature
   - `fix`: Bug fix
   - `refactor`: Code refactoring without feature change
   - `test`: Adding or updating tests
   - `docs`: Documentation changes
   - `style`: Code style/formatting changes
   - `chore`: Build process, dependencies, or tooling changes
   - `perf`: Performance improvements
   - `ci`: CI/CD configuration changes

   **Body Guidelines**:
   - List all significant changes with bullet points
   - Group changes by affected module/component
   - Include file counts and scope of changes
   - Explain the motivation if not obvious

6. **Stage Files**: Run `git add -A` to stage all changes.

7. **Commit**: Execute `git commit -m "<message>"` with the generated message.

8. **Report**: Output summary including:
   - Number of files changed
   - Types of changes made
   - Commit hash (if successful)
   - Any warnings or issues encountered

## Commit Message Template

```
<type>(<scope>): <concise summary in imperative mood>

## Changes
- <category>: <specific change description>
- <category>: <specific change description>

## Files Changed
- <count> files in <module/directory>
- <count> new test files added
- <count> i18n files updated

## Details
<Additional context about why changes were made>

Refs: #<issue-number> (if applicable)
```

## Example Commit Message

```
feat(i18n): add comprehensive internationalization support

## Changes
- i18n: Add new translation keys for chat widget, observability, screenshot, and tray modules
- i18n: Update existing zh-CN translations with improved wording
- test: Add unit tests for new components
- components: Add prompt marketplace components (author-profile, collection-card, import-export, preview-dialog)

## Files Changed
- 45 i18n JSON files updated (en + zh-CN)
- 32 new test files added
- 4 new component files created
- 3 store files modified

## Details
This commit introduces comprehensive internationalization support for multiple modules
including the chat widget, observability panel, screenshot tools, and system tray.
New prompt marketplace components are added with full test coverage.

Refs: #123
```

## Error Handling

- If lint fails and cannot auto-fix: Report specific errors and file locations
- If type check fails: List type errors with suggested fixes
- If commit fails: Check for commit hooks (husky) and report hook output
- If working directory is clean: Report "No changes to commit"

## Notes

- Always use conventional commits format for commitlint compatibility
- Keep subject line under 72 characters
- Use imperative mood ("Add feature" not "Added feature")
- Reference related issues when applicable
- For large changes, consider suggesting to split into multiple commits

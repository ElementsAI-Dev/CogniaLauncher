# How to Test Code

1. **Run all tests:** Execute `pnpm test` from project root.
2. **Run with coverage:** Use `pnpm test:coverage` for coverage report.
3. **Watch mode:** Run `pnpm test:watch` for development.
4. **Create component test:** Add `ComponentName.test.tsx` alongside component file. Mock dependencies using `jest.mock()`. Use Testing Library queries (`screen.getByRole()`, `screen.getByText()`).
5. **Create hook test:** Add `__tests__/hook-name.test.ts` in hooks directory. Test hook behavior with `renderHook` from `@testing-library/react`.
6. **Verify coverage:** Ensure coverage meets thresholds (60-70%). Report in `coverage/` directory.

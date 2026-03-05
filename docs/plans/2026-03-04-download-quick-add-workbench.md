# Download Quick Add Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace separate single-add and batch-import dialogs with one quick-add workbench that supports paste/drag/multi-line parsing, fast cleanup, and destination memory to improve download creation speed.

**Architecture:** Keep Tauri download commands unchanged and implement all orchestration in the Next.js frontend. Add a pure TypeScript quick-add transformation layer (parse, validate, dedupe, build requests), then build one unified dialog that consumes it. Wire the existing downloads page to this dialog, preserving current preflight checks and queue refresh behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand (persist), Jest + Testing Library, Tauri command bridge (`lib/tauri.ts`).

---

## Execution Guardrails

- Use `@test-driven-development` for every behavioral change.
- Use `@verification-before-completion` before claiming done.
- Use `@requesting-code-review` after full green validation.
- Keep changes DRY and YAGNI: no backend command changes, no new API surface unless required by tests.
- Commit after each task.

---

### Task 1: Quick-Add Draft Parser Utilities

**Files:**
- Create: `lib/quick-add-downloads.ts`
- Create: `lib/quick-add-downloads.test.ts`
- Reuse helper imports from: `lib/downloads.ts`

**Step 1: Write the failing test**

```ts
import { parseQuickAddInput } from "./quick-add-downloads";

it("parses multiline input into draft items with inferred names", () => {
  const drafts = parseQuickAddInput(
    "https://a.com/a.zip\n\nhttps://b.com/releases/tool.tar.gz"
  );
  expect(drafts).toHaveLength(2);
  expect(drafts[0].name).toBe("a.zip");
  expect(drafts[1].name).toBe("tool.tar.gz");
  expect(drafts.every((d) => d.status === "ready")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/quick-add-downloads.test.ts`
Expected: FAIL with module/function not found.

**Step 3: Write minimal implementation**

```ts
export type DraftStatus = "ready" | "invalid" | "duplicate";

export interface DraftDownloadItem {
  id: string;
  rawInput: string;
  url: string;
  name: string;
  status: DraftStatus;
  issues: string[];
}

export function parseQuickAddInput(raw: string): DraftDownloadItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => ({
      id: `draft-${idx + 1}`,
      rawInput: line,
      url: line,
      name: inferNameFromUrl(line),
      status: isValidUrl(line) ? "ready" : "invalid",
      issues: isValidUrl(line) ? [] : ["invalid_url"],
    }));
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/quick-add-downloads.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/quick-add-downloads.ts lib/quick-add-downloads.test.ts
git commit -m "feat(downloads): add quick-add parser utilities"
```

---

### Task 2: Dedupe + Request Builder Utilities

**Files:**
- Modify: `lib/quick-add-downloads.ts`
- Modify: `lib/quick-add-downloads.test.ts`

**Step 1: Write the failing test**

```ts
import {
  parseQuickAddInput,
  markDuplicateDrafts,
  buildReadyRequests,
} from "./quick-add-downloads";

it("marks duplicates by url+destination and only builds ready requests", () => {
  const drafts = parseQuickAddInput("https://a.com/a.zip\nhttps://a.com/a.zip");
  const withDup = markDuplicateDrafts(drafts, "D:/Downloads");
  expect(withDup.filter((d) => d.status === "duplicate")).toHaveLength(1);

  const requests = buildReadyRequests(withDup, "D:/Downloads");
  expect(requests).toHaveLength(1);
  expect(requests[0].destination).toContain("a.zip");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/quick-add-downloads.test.ts`
Expected: FAIL with function not found or assertion mismatch.

**Step 3: Write minimal implementation**

```ts
export function markDuplicateDrafts(
  drafts: DraftDownloadItem[],
  destinationDir: string
): DraftDownloadItem[] {
  const seen = new Set<string>();
  return drafts.map((d) => {
    if (d.status !== "ready") return d;
    const destination = joinDestinationPath(destinationDir, d.name);
    const key = `${d.url}::${destination}`.toLowerCase();
    if (seen.has(key)) {
      return { ...d, status: "duplicate", issues: [...d.issues, "duplicate"] };
    }
    seen.add(key);
    return d;
  });
}

export function buildReadyRequests(drafts: DraftDownloadItem[], destinationDir: string) {
  return drafts
    .filter((d) => d.status === "ready")
    .map((d) => ({
      url: d.url,
      name: d.name,
      destination: joinDestinationPath(destinationDir, d.name),
    }));
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/quick-add-downloads.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/quick-add-downloads.ts lib/quick-add-downloads.test.ts
git commit -m "feat(downloads): add quick-add dedupe and request builder"
```

---

### Task 3: Persist Last/Recent Destination in Download Store

**Files:**
- Modify: `lib/stores/download.ts`
- Modify: `lib/stores/download.test.ts`

**Step 1: Write the failing test**

```ts
it("remembers last destination and keeps most recent 5 unique directories", () => {
  const store = useDownloadStore.getState();
  store.rememberDestinationDir("D:/Downloads");
  store.rememberDestinationDir("D:/SDK");
  store.rememberDestinationDir("D:/Downloads");

  const { lastDestinationDir, recentDestinationDirs } = useDownloadStore.getState();
  expect(lastDestinationDir).toBe("D:/Downloads");
  expect(recentDestinationDirs[0]).toBe("D:/Downloads");
  expect(new Set(recentDestinationDirs).size).toBe(recentDestinationDirs.length);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/stores/download.test.ts`
Expected: FAIL with missing field/action.

**Step 3: Write minimal implementation**

```ts
lastDestinationDir: "",
recentDestinationDirs: [],
rememberDestinationDir: (dir) =>
  set((state) => {
    const normalized = dir.trim();
    if (!normalized) return {};
    const recent = [normalized, ...state.recentDestinationDirs.filter((d) => d !== normalized)].slice(0, 5);
    return { lastDestinationDir: normalized, recentDestinationDirs: recent };
  }),
```

Also include these fields in `partialize` persistence.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/stores/download.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/stores/download.ts lib/stores/download.test.ts
git commit -m "feat(downloads): persist quick-add destination memory"
```

---

### Task 4: Create Unified Quick-Add Dialog Shell

**Files:**
- Create: `components/downloads/quick-add-download-dialog.tsx`
- Create: `components/downloads/quick-add-download-dialog.test.tsx`
- Modify: `components/downloads/index.ts`

**Step 1: Write the failing test**

```tsx
it("supports single and batch entry modes in one dialog", async () => {
  render(<QuickAddDownloadDialog open initialMode="single" onOpenChange={jest.fn()} onSubmit={jest.fn()} />);
  expect(screen.getByPlaceholderText(/https:\/\/example.com\/file.zip/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("tab", { name: /batch/i }));
  expect(screen.getByPlaceholderText(/one per line/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/downloads/quick-add-download-dialog.test.tsx`
Expected: FAIL with component not found.

**Step 3: Write minimal implementation**

```tsx
type QuickAddMode = "single" | "batch";

export function QuickAddDownloadDialog(props: QuickAddDownloadDialogProps) {
  const [mode, setMode] = useState<QuickAddMode>(props.initialMode ?? "single");
  const [singleUrl, setSingleUrl] = useState("");
  const [batchText, setBatchText] = useState("");
  // render one Dialog with tabs; single uses Input, batch uses Textarea
}
```

Export from `components/downloads/index.ts`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/downloads/quick-add-download-dialog.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/downloads/quick-add-download-dialog.tsx components/downloads/quick-add-download-dialog.test.tsx components/downloads/index.ts
git commit -m "feat(downloads): add unified quick-add dialog shell"
```

---

### Task 5: Add Preview List + Batch Cleanup Actions to Quick-Add Dialog

**Files:**
- Modify: `components/downloads/quick-add-download-dialog.tsx`
- Modify: `components/downloads/quick-add-download-dialog.test.tsx`
- Modify: `lib/quick-add-downloads.ts`

**Step 1: Write the failing test**

```tsx
it("cleans invalid and duplicate drafts, then submits only ready items", async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(<QuickAddDownloadDialog open initialMode="batch" onOpenChange={jest.fn()} onSubmit={onSubmit} />);

  await userEvent.type(screen.getByRole("textbox", { name: /urls/i }), [
    "https://a.com/a.zip",
    "not-url",
    "https://a.com/a.zip",
  ].join("\n"));

  await userEvent.click(screen.getByRole("button", { name: /clean invalid/i }));
  await userEvent.click(screen.getByRole("button", { name: /clean duplicates/i }));
  await userEvent.click(screen.getByRole("button", { name: /add to queue/i }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ url: "https://a.com/a.zip" })])
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/downloads/quick-add-download-dialog.test.tsx`
Expected: FAIL with missing buttons/behavior.

**Step 3: Write minimal implementation**

```tsx
const parsed = useMemo(() => markDuplicateDrafts(parseQuickAddInput(inputText), destinationDir), [inputText, destinationDir]);
const ready = parsed.filter((d) => d.status === "ready");

const cleanInvalid = () => setInputText(parsed.filter((d) => d.status !== "invalid").map((d) => d.url).join("\n"));
const cleanDuplicates = () => setInputText(parsed.filter((d) => d.status !== "duplicate").map((d) => d.url).join("\n"));

const handleSubmit = async () => {
  await onSubmit(buildReadyRequests(parsed, destinationDir));
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/downloads/quick-add-download-dialog.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/downloads/quick-add-download-dialog.tsx components/downloads/quick-add-download-dialog.test.tsx lib/quick-add-downloads.ts
git commit -m "feat(downloads): add quick-add preview cleanup and submit filtering"
```

---

### Task 6: Wire Downloads Page to Unified Dialog

**Files:**
- Modify: `app/downloads/page.tsx`
- Modify: `app/downloads/page.test.tsx`
- Keep existing components for fallback: `components/downloads/add-download-dialog.tsx`, `components/downloads/batch-import-dialog.tsx` (no behavior change)

**Step 1: Write the failing test**

```tsx
it("opens the same quick-add dialog from Add Download and Batch Import buttons", async () => {
  renderWithProviders(<DownloadsPage />);
  await userEvent.click(screen.getByRole("button", { name: /add download/i }));
  expect(screen.getByTestId("quick-add-dialog")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /batch import/i }));
  expect(screen.getByTestId("quick-add-dialog")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand app/downloads/page.test.tsx`
Expected: FAIL because page still opens two separate dialogs.

**Step 3: Write minimal implementation**

```tsx
const [quickAddOpen, setQuickAddOpen] = useState(false);
const [quickAddMode, setQuickAddMode] = useState<"single" | "batch">("single");

const openQuickAdd = (mode: "single" | "batch") => {
  setQuickAddMode(mode);
  setQuickAddOpen(true);
};

<Button onClick={() => openQuickAdd("single")}>...</Button>
<Button onClick={() => openQuickAdd("batch")}>...</Button>

<QuickAddDownloadDialog
  open={quickAddOpen}
  initialMode={quickAddMode}
  onOpenChange={setQuickAddOpen}
  onSubmit={handleQuickAddSubmit}
/>
```

`handleQuickAddSubmit` should reuse existing preflight and queue refresh logic for each request.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand app/downloads/page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/downloads/page.tsx app/downloads/page.test.tsx
git commit -m "refactor(downloads): route add and batch flows through quick-add dialog"
```

---

### Task 7: Add New i18n Keys + Regression Test

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Create: `messages/downloads-quick-add.test.ts`

**Step 1: Write the failing test**

```ts
import en from "./en.json";
import zh from "./zh.json";

const requiredKeys = [
  "downloads.quickAdd.title",
  "downloads.quickAdd.modeSingle",
  "downloads.quickAdd.modeBatch",
  "downloads.quickAdd.cleanInvalid",
  "downloads.quickAdd.cleanDuplicates",
  "downloads.quickAdd.recentDestinations",
];

it.each(requiredKeys)("has key %s in en and zh", (key) => {
  expect(readKey(en, key)).toBeTruthy();
  expect(readKey(zh, key)).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand messages/downloads-quick-add.test.ts`
Expected: FAIL because keys do not exist yet.

**Step 3: Write minimal implementation**

```json
"quickAdd": {
  "title": "Quick Add Downloads",
  "modeSingle": "Single",
  "modeBatch": "Batch",
  "cleanInvalid": "Clean Invalid",
  "cleanDuplicates": "Clean Duplicates",
  "recentDestinations": "Recent Destinations"
}
```

Add equivalent Chinese copy in `messages/zh.json`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand messages/downloads-quick-add.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add messages/en.json messages/zh.json messages/downloads-quick-add.test.ts
git commit -m "feat(i18n): add quick-add dialog locale keys with regression test"
```

---

### Task 8: Update User Docs + Run Final Verification

**Files:**
- Modify: `docs/en/guide/downloads.md`
- Modify: `docs/zh/guide/downloads.md`

**Step 1: Update docs with quick-add workflow**

```md
### Quick Add Workbench
- Single + batch URL entry in one dialog
- Auto-parse URL list with duplicate/invalid cleanup
- Remember last and recent destination folders
```

Add mirrored Chinese section in `docs/zh/guide/downloads.md`.

**Step 2: Run focused validation**

Run:
- `pnpm test -- --runInBand lib/quick-add-downloads.test.ts`
- `pnpm test -- --runInBand components/downloads/quick-add-download-dialog.test.tsx`
- `pnpm test -- --runInBand app/downloads/page.test.tsx`
- `pnpm test -- --runInBand messages/downloads-quick-add.test.ts`

Expected: All PASS.

**Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS with no new lint errors in changed files.

**Step 4: Final commit**

```bash
git add docs/en/guide/downloads.md docs/zh/guide/downloads.md
git commit -m "docs(downloads): document quick-add workbench flow"
```

---

## Final Verification Checklist

- [ ] Add and Batch buttons open the same dialog component.
- [ ] Paste/drag/multi-line parsing creates draft rows immediately.
- [ ] Invalid and duplicate cleanup actions work without page refresh.
- [ ] Destination memory appears and updates after successful submission.
- [ ] Preflight warnings/errors still use existing `runDownloadPreflightWithUi`.
- [ ] Queue refresh + stats refresh happen after successful quick-add submit.
- [ ] All listed tests and lint pass.


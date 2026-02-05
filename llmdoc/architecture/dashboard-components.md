# Architecture of Dashboard UI Components

## 1. Identity

- **What it is:** Modular dashboard component architecture with responsive flexbox layouts.
- **Purpose:** Display environment and package lists with proper text overflow handling across varying content lengths.

## 2. Core Components

- `components/dashboard/environment-list.tsx` (EnvironmentList, EnvironmentItem): Environment list with filtering and status indicators.
- `components/dashboard/package-list.tsx` (PackageList, PackageItem): Package list with search functionality.
- `components/dashboard/quick-search.tsx` (QuickSearch, SearchResultItem): Global search with keyboard navigation.
- `components/dashboard/stats-card.tsx` (StatsCard): Dashboard statistics display.

## 3. Execution Flow (LLM Retrieval Map)

- **Data Ingestion:** Dashboard page fetches environments and packages via `use-environments.ts` and `use-packages.ts` hooks.
- **List Rendering:** `EnvironmentList` (line 31-151) and `PackageList` (line 23-157) filter and display items.
- **Item Layout:** Both `EnvironmentItem` (line 160-212) and `PackageItem` (line 165-193) use flexbox pattern with overflow handling.
- **Search:** `QuickSearch` (line 44-365) filters environments and packages with localStorage history.

## 4. Design Rationale

- **Flexbox Overflow Pattern:** `min-w-0 flex-1` on text containers allows proper truncation with `truncate` utility.
- **Badge Constraints:** `shrink-0` prevents badge shrinking, `max-w-[140px] truncate` limits version badge width.
- **Icon Containers:** `shrink-0` on icon divs prevents them from being compressed.
- **Pattern:** `<div className="flex items-center gap-3 min-w-0 flex-1">` for text content, `<div className="flex items-center gap-2 shrink-0">` for trailing elements.

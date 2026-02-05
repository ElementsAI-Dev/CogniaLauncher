# Provider Version Detection Enhancement API

## 1. Core Summary

Enhanced version metadata returned by providers including release dates, yanked/deprecated status, and download counts.

## 2. Source of Truth

- **Provider Traits:** `src-tauri/src/provider/traits.rs:274-296` - EnvironmentProvider trait with detect_version()
- **Enhanced Providers:** `src-tauri/src/provider/bundler.rs`, `src-tauri/src/provider/composer.rs`, `src-tauri/src/provider/dotnet.rs`, `src-tauri/src/provider/poetry.rs`
- **TypeScript Types:** `lib/tauri.ts` - VersionInfo interface definitions

## 3. Enhanced Metadata

**RubyGems (bundler.rs):**
- Release date (`released_at`)
- Yanked status (`yanked`)
- Version checksums

**NuGet (dotnet.rs):**
- Per-version download counts (`download_count`)
- Published date (`published_at`)
- Total search hits (`total_hits`)

**Packagist (composer.rs):**
- Total search result count (`total`)
- Description and homepage URLs

**Poetry:**
- Home install path detection via `POETRY_HOME` environment variable

## 4. VersionInfo Structure

```typescript
interface VersionInfo {
  version: string
  source?: 'local' | 'remote' | 'system_executable'
  installed?: boolean
  aliases?: string[]  // e.g., 'lts', 'latest', 'stable'
  release_date?: string
  yanked?: boolean
  download_count?: number
  checksum?: string
}
```

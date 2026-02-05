# External Cache System

## Overview

Cross-platform discovery and cleanup of external package manager caches.

## Supported Providers

| Provider | Command | Cache Path (Windows) | Cache Path (Unix) |
|----------|---------|---------------------|-------------------|
| npm | `npm cache clean --force` | `%LOCALAPPDATA%/npm-cache` | `~/.npm` |
| pnpm | `pnpm store prune` | `%LOCALAPPDATA%/pnpm/store` | `~/.local/share/pnpm/store` |
| yarn | `yarn cache clean` | `%LOCALAPPDATA%/Yarn/Cache` | `~/Library/Caches/Yarn` (macOS), `~/.cache/yarn` (Linux) |
| pip | `pip cache purge` | `%LOCALAPPDATA%/pip/Cache` | `~/Library/Caches/pip` (macOS), `~/.cache/pip` (Linux) |
| uv | `uv cache clean` | `%LOCALAPPDATA%/uv/cache` | `~/.cache/uv` |
| cargo | Direct delete | `%USERPROFILE%/.cargo/registry/cache` | `~/.cargo/registry/cache` |
| bundler | `bundle clean --force` | `%LOCALAPPDATA%/cache/bundle` | `~/.bundle/cache` |
| go | `go clean -modcache` | `%USERPROFILE%/go/pkg/mod/cache` | `~/go/pkg/mod/cache` |
| brew | `brew cleanup --prune=all` | N/A | `~/Library/Caches/Homebrew` |
| dotnet | `dotnet nuget locals all --clear` | `%LOCALAPPDATA%/NuGet/v3-cache` | `~/.nuget/packages` |

## Architecture

```
src-tauri/src/cache/external.rs    # Core module
├── ExternalCacheProvider          # Enum of supported providers
├── ExternalCacheInfo              # Cache discovery result
├── ExternalCacheCleanResult       # Cleanup result
├── discover_all_caches()          # Discover all caches
├── clean_cache()                  # Clean single provider
└── clean_all_caches()             # Clean all providers
```

## Tauri Commands

- `discover_external_caches` - List all external caches
- `clean_external_cache` - Clean specific provider
- `clean_all_external_caches` - Clean all providers
- `get_combined_cache_stats` - Internal + external stats

## Frontend

- `lib/tauri.ts` - TypeScript bindings
- `components/cache/external-cache-section.tsx` - UI component

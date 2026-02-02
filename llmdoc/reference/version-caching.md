# Version Caching Reference

## 1. Core Summary

Time-based version list caching with automatic expiry to reduce backend API calls and improve UI responsiveness.

## 2. Source of Truth

- **Primary Hook:** `lib/hooks/use-version-cache.ts` - Generic cache with expiry
- **Environment Cache:** `lib/hooks/use-version-cache.ts:79-121` - Environment-specific version cache
- **Default Expiry:** `lib/hooks/use-version-cache.ts:15` - 5 minutes (300000ms)
- **Tests:** `lib/hooks/__tests__/use-version-cache.test.ts` - Cache behavior validation

## 3. Cache Operations

**Generic Cache (`useVersionCache`):**
- `get(key)` - Retrieve cached data or null if expired/missing
- `set(key, data)` - Store data with current timestamp
- `invalidate(key)` - Remove specific entry
- `invalidateAll()` - Clear all cache entries
- `isValid(key)` - Check if entry exists and not expired

**Environment Cache (`useAvailableVersionsCache`):**
- `getCachedVersions(envType)` - Get versions if cache valid
- `setCachedVersions(envType, versions)` - Store with timestamp
- `isCacheValid(envType)` - Check expiry per environment
- `invalidateCache(envType?)` - Clear specific or all

## 4. Integration

Works with `useEnvironmentStore` to cache available versions per environment type (nodejs, python, rust).

# Error Handling Reference

## 1. Core Summary

Structured error parsing and user-friendly error messaging for frontend-backend communication. Maps backend Rust errors to frontend error types with actionable suggestions.

## 2. Source of Truth

- **Primary Code:** `lib/errors.ts` - Error types, parsing, and utility functions
- **Type Definitions:** `lib/errors.ts:7-27` - ErrorCode union type and CogniaError interface
- **Error Patterns:** `lib/errors.ts:37-57` - Regex patterns for error detection
- **Suggestions:** `lib/errors.ts:60-81` - User-facing error messages
- **i18n Keys:** `lib/errors.ts:84-105` - Localization key mappings
- **Tests:** `lib/__tests__/errors.test.ts` - Error parsing and validation tests

## 3. Error Categories

**Network Errors:** NETWORK_ERROR, DOWNLOAD_ERROR - retry with connection check
**Permission Errors:** PERMISSION_DENIED - require elevation
**Package Errors:** PACKAGE_NOT_FOUND, VERSION_NOT_FOUND - verify input
**Installation Errors:** INSTALLATION_ERROR, CHECKSUM_MISMATCH - retry or clear cache
**Configuration Errors:** CONFIG_ERROR, PROVIDER_NOT_FOUND - fix settings
**Non-Recoverable:** PLATFORM_NOT_SUPPORTED, CANCELLED, INTERNAL_ERROR - cannot retry

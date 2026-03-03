# Version Caching Reference

## 1. Current Status

The standalone `use-version-cache` hook has been removed.

## 2. Reason

The hook was no longer used at runtime and created duplicate maintenance cost.

## 3. Current Behavior

Version loading now relies on existing feature hooks and store updates directly, without a dedicated generic in-memory version-cache hook.

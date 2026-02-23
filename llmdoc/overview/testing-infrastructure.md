# Testing Infrastructure

## 1. Identity

- **What it is:** Jest 30 + Testing Library test framework with coverage thresholds.
- **Purpose:** Automated testing for frontend components, hooks, stores, and utilities.

## 2. High-Level Description

Comprehensive testing infrastructure covering:
- Component rendering and interaction (Testing Library)
- Hook behavior and state management
- Store persistence and actions
- Error handling and parsing
- Type definitions validation
- Coverage enforcement (60-70% thresholds)

**Test Coverage:** 100+ frontend test files (55+ component tests, 18+ hook tests, 7 store tests, 4 page tests) plus 270+ Rust unit tests. Tests are co-located with source files (`*.test.ts`, `*.test.tsx`) across `hooks/`, `components/`, `lib/stores/__tests__/`, and `app/` directories.

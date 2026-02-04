# Command Palette

## 1. Identity

- **What it is:** A keyboard-driven command palette for quick navigation and actions.
- **Purpose:** Provide efficient keyboard-only access to all major application features and navigation paths.

## 2. High-Level Description

The command palette is a modal dialog built with shadcn/ui's Command component that provides fuzzy search across navigation items, settings, and common actions. It's accessible via `Ctrl+K` (or `Cmd+K` on macOS) and integrates with the router for navigation and the log store for quick actions. The palette is locale-aware and supports keyboard navigation.

# System Tray

## 1. Identity

- **What it is:** A multi-language system tray with dynamic icon states, autostart, notifications, configurable click behavior, and shared desktop action routing.
- **Purpose:** Provide background presence, quick access to core functionality, and system-level integration.

## 2. High-Level Description

The system tray provides a persistent background interface with context menu actions (show/hide, settings, updates, logs, quit), plus optional action-backed entries such as command palette, quick search, toolbox, and plugin management. Icon states reflect application status (normal, downloading, update available, error). Supports autostart management, system notifications, configurable left-click behavior, and shared desktop action dispatch so tray-triggered UI actions can reuse the same frontend execution model as command palette and global shortcuts. Language syncs automatically with app locale.

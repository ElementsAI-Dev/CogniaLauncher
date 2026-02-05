# Health Check System Architecture

## 1. Identity

- **What it is:** Diagnostic system for environment and system health validation.
- **Purpose:** Detect issues with installed environments and provide actionable remediation steps.

## 2. Core Components

- `src-tauri/src/core/health_check.rs` (HealthChecker, HealthIssue, HealthCheckResult): Core health checking logic with issue detection and categorization.
- `src-tauri/src/commands/health_check.rs` (health_check_all, health_check_environment): Tauri commands for triggering health checks.
- `hooks/use-health-check.ts` (useHealthCheck): React hook for health check operations.
- `components/environments/health-check-panel.tsx` (HealthCheckPanel): UI component for displaying health check results.

## 3. Execution Flow (LLM Retrieval Map)

- **1. Trigger:** User initiates health check via `components/environments/health-check-panel.tsx`.
- **2. Command:** Frontend calls `health_check_all` or `health_check_environment` via `hooks/use-health-check.ts`.
- **3. Detection:** `src-tauri/src/core/health_check.rs:15-85` validates environments and detects issues.
- **4. Results:** Returns `HealthCheckResult` with issues array, each containing severity, category, and remediation steps.

## 4. Design Rationale

**Severity levels:** Issues are categorized by severity (error, warning, info) to help users prioritize fixes.

**Issue categories:** Groups issues by type (missing_executable, path_problem, corrupted_install, dependency_missing) for targeted remediation.

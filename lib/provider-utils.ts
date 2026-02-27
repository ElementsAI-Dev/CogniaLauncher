import type { HealthStatus, Severity } from "@/types/tauri";

/**
 * Map health status to CSS border/background color classes.
 */
export function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950";
    case "warning":
      return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950";
    case "error":
      return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950";
    default:
      return "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950";
  }
}

/**
 * Map severity to Alert component variant.
 */
export function getAlertVariant(severity: Severity): "default" | "destructive" {
  switch (severity) {
    case "critical":
    case "error":
      return "destructive";
    default:
      return "default";
  }
}

/**
 * Map history action to CSS badge color classes.
 */
export function getActionColor(action: string): string {
  switch (action.toLowerCase()) {
    case "install":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "uninstall":
    case "remove":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "update":
    case "upgrade":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "rollback":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

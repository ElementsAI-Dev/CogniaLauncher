export const DASHBOARD_QUICK_SEARCH_FOCUS_EVENT =
  "cognia:dashboard-quick-search-focus";

const DASHBOARD_QUICK_SEARCH_PENDING_KEY =
  "cognia:dashboard-quick-search-focus-pending";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function requestDashboardQuickSearchFocus(): void {
  if (typeof window === "undefined") {
    return;
  }

  getSessionStorage()?.setItem(DASHBOARD_QUICK_SEARCH_PENDING_KEY, "1");
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_QUICK_SEARCH_FOCUS_EVENT),
  );
}

export function consumeDashboardQuickSearchFocusRequest(): boolean {
  const storage = getSessionStorage();
  if (!storage) {
    return false;
  }

  const hasPendingRequest =
    storage.getItem(DASHBOARD_QUICK_SEARCH_PENDING_KEY) === "1";
  if (hasPendingRequest) {
    storage.removeItem(DASHBOARD_QUICK_SEARCH_PENDING_KEY);
  }
  return hasPendingRequest;
}

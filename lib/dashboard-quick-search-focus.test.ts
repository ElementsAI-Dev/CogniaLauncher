import {
  consumeDashboardQuickSearchFocusRequest,
  DASHBOARD_QUICK_SEARCH_FOCUS_EVENT,
  requestDashboardQuickSearchFocus,
} from './dashboard-quick-search-focus';

describe('dashboard-quick-search-focus', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('persists a pending focus request and dispatches the dashboard event', () => {
    const listener = jest.fn();
    window.addEventListener(DASHBOARD_QUICK_SEARCH_FOCUS_EVENT, listener);

    requestDashboardQuickSearchFocus();

    expect(window.sessionStorage.getItem('cognia:dashboard-quick-search-focus-pending')).toBe('1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toBeInstanceOf(CustomEvent);

    window.removeEventListener(DASHBOARD_QUICK_SEARCH_FOCUS_EVENT, listener);
  });

  it('consumes a pending request exactly once', () => {
    window.sessionStorage.setItem('cognia:dashboard-quick-search-focus-pending', '1');

    expect(consumeDashboardQuickSearchFocusRequest()).toBe(true);
    expect(consumeDashboardQuickSearchFocusRequest()).toBe(false);
    expect(window.sessionStorage.getItem('cognia:dashboard-quick-search-focus-pending')).toBeNull();
  });

  it('returns false when no request is pending', () => {
    expect(consumeDashboardQuickSearchFocusRequest()).toBe(false);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvUpdatesSummary } from "./env-updates-summary";
import type { EnvUpdateCheckResult } from "@/lib/tauri";

const t = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    "environments.updates.allUpToDate": "All environments are up to date",
    "environments.updates.recheck": "Recheck",
    "environments.updates.checkingAll": "Checking all environments for updates...",
    "environments.updates.outdatedCount": `${params?.count ?? 0} environment(s) have updates available`,
    "environments.updates.upgradeToVersion": "Upgrade",
  };
  return translations[key] || key;
};

const makeResult = (
  envType: string,
  current: string | null,
  latest: string | null,
  isOutdated: boolean,
): EnvUpdateCheckResult => ({
  envType,
  providerId: "test",
  currentVersion: current,
  latestVersion: latest,
  latestLts: latest,
  newerCount: isOutdated ? 1 : 0,
  isOutdated,
});

describe("EnvUpdatesSummary", () => {
  it("renders nothing when no results and not loading", () => {
    const { container } = render(
      <EnvUpdatesSummary
        results={{}}
        loading={false}
        onCheckAll={jest.fn()}
        onUpgrade={jest.fn()}
        t={t}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state when checking", () => {
    render(
      <EnvUpdatesSummary
        results={{}}
        loading={true}
        onCheckAll={jest.fn()}
        onUpgrade={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("Checking all environments for updates...")).toBeInTheDocument();
  });

  it("shows all up to date when no outdated results", () => {
    const results = {
      node: makeResult("node", "22.0.0", "22.0.0", false),
      python: makeResult("python", "3.12.0", "3.12.0", false),
    };
    render(
      <EnvUpdatesSummary
        results={results}
        loading={false}
        onCheckAll={jest.fn()}
        onUpgrade={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("All environments are up to date")).toBeInTheDocument();
  });

  it("shows outdated count and upgrade buttons", () => {
    const results = {
      node: makeResult("node", "20.10.0", "22.0.0", true),
      python: makeResult("python", "3.11.0", "3.12.0", true),
    };
    render(
      <EnvUpdatesSummary
        results={results}
        loading={false}
        onCheckAll={jest.fn()}
        onUpgrade={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("2 environment(s) have updates available")).toBeInTheDocument();
    const upgradeButtons = screen.getAllByText("Upgrade");
    expect(upgradeButtons).toHaveLength(2);
  });

  it("calls onUpgrade with correct params when upgrade button clicked", async () => {
    const user = userEvent.setup();
    const onUpgrade = jest.fn();
    const results = {
      node: makeResult("node", "20.10.0", "22.0.0", true),
    };
    render(
      <EnvUpdatesSummary
        results={results}
        loading={false}
        onCheckAll={jest.fn()}
        onUpgrade={onUpgrade}
        t={t}
      />,
    );
    await user.click(screen.getByText("Upgrade"));
    expect(onUpgrade).toHaveBeenCalledWith("node", "22.0.0");
  });

  it("calls onCheckAll when recheck button clicked", async () => {
    const user = userEvent.setup();
    const onCheckAll = jest.fn().mockResolvedValue([]);
    const results = {
      node: makeResult("node", "22.0.0", "22.0.0", false),
    };
    render(
      <EnvUpdatesSummary
        results={results}
        loading={false}
        onCheckAll={onCheckAll}
        onUpgrade={jest.fn()}
        t={t}
      />,
    );
    await user.click(screen.getByText("Recheck"));
    expect(onCheckAll).toHaveBeenCalled();
  });

  it("shows mixed results correctly", () => {
    const results = {
      node: makeResult("node", "20.10.0", "22.0.0", true),
      python: makeResult("python", "3.12.0", "3.12.0", false),
      go: makeResult("go", "1.21.0", "1.22.0", true),
    };
    render(
      <EnvUpdatesSummary
        results={results}
        loading={false}
        onCheckAll={jest.fn()}
        onUpgrade={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("2 environment(s) have updates available")).toBeInTheDocument();
    expect(screen.getByText("node")).toBeInTheDocument();
    expect(screen.getByText("go")).toBeInTheDocument();
  });
});

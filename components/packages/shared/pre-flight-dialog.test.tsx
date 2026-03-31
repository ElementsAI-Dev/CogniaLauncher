import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreFlightDialog } from "./pre-flight-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.preflight.title": "Pre-flight summary",
        "packages.preflight.description": "Review package validation findings before install.",
        "packages.preflight.passCount": `Passed ${params?.count ?? 0}`,
        "packages.preflight.warningCount": `Warnings ${params?.count ?? 0}`,
        "packages.preflight.failureCount": `Failures ${params?.count ?? 0}`,
        "packages.preflight.blockingMessage": "Resolve blocking issues before continuing.",
        "packages.preflight.confirm": "Continue install",
        "packages.preflight.cancel": "Cancel",
      };
      return translations[key] ?? key;
    },
  }),
}));

const warningSummary = {
  results: [
    {
      validator_id: "provider_health",
      validator_name: "Provider health",
      status: "warning",
      summary: "Provider health check returned warnings.",
      details: ["Provider status is degraded."],
      remediation: "Review provider diagnostics before proceeding.",
      package: "react",
      provider_id: "npm",
      blocking: false,
      timed_out: false,
    },
  ],
  can_proceed: true,
  has_warnings: true,
  has_failures: false,
  checked_at: "2026-03-29T00:00:00.000Z",
};

describe("PreFlightDialog", () => {
  it("renders validation findings and package list", () => {
    render(
      <PreFlightDialog
        open
        packages={["npm:react"]}
        summary={warningSummary}
        onConfirm={jest.fn()}
        onOpenChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Pre-flight summary")).toBeInTheDocument();
    expect(screen.getByText("Provider health check returned warnings.")).toBeInTheDocument();
    expect(screen.getByText("Provider status is degraded.")).toBeInTheDocument();
    expect(screen.getByText("Review provider diagnostics before proceeding.")).toBeInTheDocument();
    expect(screen.getByText("npm:react")).toBeInTheDocument();
  });

  it("allows continue when findings are warnings only", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(
      <PreFlightDialog
        open
        packages={["npm:react"]}
        summary={warningSummary}
        onConfirm={onConfirm}
        onOpenChange={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continue install" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("blocks continue when summary contains failures", () => {
    render(
      <PreFlightDialog
        open
        packages={["npm:react"]}
        summary={{
          ...warningSummary,
          can_proceed: false,
          has_warnings: false,
          has_failures: true,
          results: [
            {
              ...warningSummary.results[0],
              status: "failure",
              blocking: true,
              summary: "Not enough free disk space.",
            },
          ],
        }}
        onConfirm={jest.fn()}
        onOpenChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Resolve blocking issues before continuing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue install" })).toBeDisabled();
  });
});

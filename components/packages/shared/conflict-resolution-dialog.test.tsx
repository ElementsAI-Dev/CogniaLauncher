import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConflictResolutionDialog } from "./conflict-resolution-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.conflictDialog.title": `Resolve ${params?.name ?? ""}`,
        "packages.conflictDialog.description": "Choose a strategy for this dependency conflict.",
        "packages.conflictDialog.latestCompatible": "Latest compatible",
        "packages.conflictDialog.minimalUpgrade": "Minimal upgrade",
        "packages.conflictDialog.manual": "Manual",
        "packages.conflictDialog.manualVersion": "Manual version",
        "packages.conflictDialog.resolve": "Resolve conflict",
        "packages.conflictDialog.cancel": "Cancel",
      };
      return translations[key] ?? key;
    },
  }),
}));

const conflict = {
  package_name: "urllib3",
  required_by: ["requests", "botocore"],
  versions: ["^1.26.0", "^2.0.0"],
  resolution: "Prefer urllib3 2.0.7",
};

describe("ConflictResolutionDialog", () => {
  it("renders conflict details", () => {
    render(
      <ConflictResolutionDialog
        open
        conflict={conflict}
        onOpenChange={jest.fn()}
        onResolve={jest.fn()}
      />,
    );

    expect(screen.getByText("Resolve urllib3")).toBeInTheDocument();
    expect(screen.getByText("requests")).toBeInTheDocument();
    expect(screen.getByText("botocore")).toBeInTheDocument();
  });

  it("submits selected strategy", async () => {
    const user = userEvent.setup();
    const onResolve = jest.fn();

    render(
      <ConflictResolutionDialog
        open
        conflict={conflict}
        onOpenChange={jest.fn()}
        onResolve={onResolve}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Resolve conflict" }));

    expect(onResolve).toHaveBeenCalledWith("latest_compatible", undefined);
  });

  it("submits manual version when manual strategy is selected", async () => {
    const user = userEvent.setup();
    const onResolve = jest.fn();

    render(
      <ConflictResolutionDialog
        open
        conflict={conflict}
        onOpenChange={jest.fn()}
        onResolve={onResolve}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.type(screen.getByPlaceholderText("Manual version"), "2.0.7");
    await user.click(screen.getByRole("button", { name: "Resolve conflict" }));

    expect(onResolve).toHaveBeenCalledWith("manual", "2.0.7");
  });
});

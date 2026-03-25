import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderEmptyState } from "./provider-empty-state";

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("ProviderEmptyState", () => {
  const mockOnClearFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders no results message when filters are active", () => {
    render(
      <ProviderEmptyState
        hasFilters={true}
        onClearFilters={mockOnClearFilters}
      />,
    );

    expect(
      screen.getByText("providers.noResults"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("providers.noResultsDesc"),
    ).toBeInTheDocument();
    expect(screen.getByText("providers.clearFilters")).toBeInTheDocument();
  });

  it("renders no providers message when no filters are active", () => {
    render(
      <ProviderEmptyState
        hasFilters={false}
        onClearFilters={mockOnClearFilters}
      />,
    );

    expect(screen.getByText("providers.noProviders")).toBeInTheDocument();
    expect(
      screen.getByText("providers.noProvidersDesc"),
    ).toBeInTheDocument();
    expect(screen.queryByText("providers.clearFilters")).not.toBeInTheDocument();
  });

  it("calls onClearFilters when clear filters button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProviderEmptyState
        hasFilters={true}
        onClearFilters={mockOnClearFilters}
      />,
    );

    const clearButton = screen.getByText("providers.clearFilters");
    await user.click(clearButton);

    expect(mockOnClearFilters).toHaveBeenCalled();
  });

  it("does not show clear filters button when no filters active", () => {
    render(
      <ProviderEmptyState
        hasFilters={false}
        onClearFilters={mockOnClearFilters}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

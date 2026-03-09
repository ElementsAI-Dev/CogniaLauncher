import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthSection } from "./auth-section";

describe("AuthSection", () => {
  const defaultProps = {
    token: "",
    onTokenChange: jest.fn(),
    onSave: jest.fn(),
    onClear: jest.fn(),
    saveDisabled: false,
    clearDisabled: false,
    saveLabel: "Save Token",
    clearLabel: "Clear Token",
    hint: "Auth hint",
    configured: false,
    t: (key: string) => key,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function openSection() {
    await userEvent.click(screen.getByText("downloads.auth.title"));
  }

  it("renders title and configured badge", () => {
    render(<AuthSection {...defaultProps} configured={true} />);

    expect(screen.getByText("downloads.auth.title")).toBeInTheDocument();
    expect(screen.getByText("downloads.auth.configured")).toBeInTheDocument();
  });

  it("updates token and supports show/hide toggle", async () => {
    const onTokenChange = jest.fn();
    const { rerender } = render(
      <AuthSection
        {...defaultProps}
        token="secret-token"
        onTokenChange={onTokenChange}
      />,
    );

    await openSection();

    const tokenInput = screen.getByPlaceholderText(
      "downloads.auth.tokenPlaceholder",
    ) as HTMLInputElement;
    expect(tokenInput.type).toBe("password");

    const toggleButton = tokenInput.parentElement?.querySelector("button");
    expect(toggleButton).toBeInTheDocument();

    await userEvent.click(toggleButton as HTMLButtonElement);
    expect(tokenInput.type).toBe("text");

    await userEvent.type(tokenInput, "x");
    expect(onTokenChange).toHaveBeenCalled();

    rerender(
      <AuthSection
        {...defaultProps}
        token="next-token"
        onTokenChange={onTokenChange}
      />,
    );
  });

  it("calls save and clear handlers", async () => {
    const onSave = jest.fn();
    const onClear = jest.fn();
    render(
      <AuthSection {...defaultProps} onSave={onSave} onClear={onClear} />,
    );

    await openSection();
    await userEvent.click(screen.getByRole("button", { name: "Save Token" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear Token" }));

    expect(onSave).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });

  it("respects save and clear disabled states", async () => {
    render(
      <AuthSection
        {...defaultProps}
        saveDisabled={true}
        clearDisabled={true}
      />,
    );

    await openSection();
    expect(
      screen.getByRole("button", { name: "Save Token" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Clear Token" }),
    ).toBeDisabled();
  });

  it("renders instance url controls when handlers are provided", async () => {
    const onInstanceUrlChange = jest.fn();
    const onSaveInstanceUrl = jest.fn();
    render(
      <AuthSection
        {...defaultProps}
        instanceUrl="https://gitlab.example.com"
        onInstanceUrlChange={onInstanceUrlChange}
        onSaveInstanceUrl={onSaveInstanceUrl}
        instanceUrlLabel="Instance URL"
        instanceUrlSaveLabel="Save URL"
      />,
    );

    await openSection();

    const instanceInput = screen.getByPlaceholderText(
      "downloads.auth.instanceUrlPlaceholder",
    );
    await userEvent.type(instanceInput, "/api");
    expect(onInstanceUrlChange).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Save URL" }));
    expect(onSaveInstanceUrl).toHaveBeenCalled();
  });

  it("does not render instance url controls by default", async () => {
    render(<AuthSection {...defaultProps} />);

    await openSection();
    expect(
      screen.queryByPlaceholderText("downloads.auth.instanceUrlPlaceholder"),
    ).not.toBeInTheDocument();
  });
});

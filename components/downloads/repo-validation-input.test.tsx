import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepoValidationInput } from "./repo-validation-input";

describe("RepoValidationInput", () => {
  const defaultProps = {
    value: "",
    onChange: jest.fn(),
    onValidate: jest.fn(),
    isValidating: false,
    isValid: null as boolean | null,
    placeholder: "owner/repo",
    label: "Repository",
    fetchLabel: "Fetch",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders label, input, and fetch button", () => {
    render(<RepoValidationInput {...defaultProps} />);

    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("owner/repo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fetch/i })).toBeInTheDocument();
  });

  it("reflects value prop and calls onChange on typing", async () => {
    const onChange = jest.fn();
    render(
      <RepoValidationInput {...defaultProps} value="test" onChange={onChange} />,
    );

    const input = screen.getByPlaceholderText("owner/repo");
    expect(input).toHaveValue("test");

    await userEvent.type(input, "/repo");
    expect(onChange).toHaveBeenCalled();
  });

  it("disables fetch button when input value is empty", () => {
    render(<RepoValidationInput {...defaultProps} value="" />);

    expect(screen.getByRole("button", { name: /fetch/i })).toBeDisabled();
  });

  it("disables fetch button when isValidating is true", () => {
    render(
      <RepoValidationInput
        {...defaultProps}
        value="owner/repo"
        isValidating={true}
      />,
    );

    expect(screen.getByRole("button", { name: /fetch/i })).toBeDisabled();
  });

  it("enables fetch button when value is non-empty and not validating", () => {
    render(
      <RepoValidationInput {...defaultProps} value="owner/repo" />,
    );

    expect(screen.getByRole("button", { name: /fetch/i })).not.toBeDisabled();
  });

  it("calls onValidate when fetch button is clicked", async () => {
    const onValidate = jest.fn();
    render(
      <RepoValidationInput
        {...defaultProps}
        value="owner/repo"
        onValidate={onValidate}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /fetch/i }));

    expect(onValidate).toHaveBeenCalled();
  });

  it("calls onValidate on Enter key press", async () => {
    const onValidate = jest.fn();
    render(
      <RepoValidationInput
        {...defaultProps}
        value="owner/repo"
        onValidate={onValidate}
      />,
    );

    const input = screen.getByPlaceholderText("owner/repo");
    await userEvent.type(input, "{Enter}");

    expect(onValidate).toHaveBeenCalled();
  });

  it("shows spinner icon when isValidating is true", () => {
    const { container } = render(
      <RepoValidationInput {...defaultProps} isValidating={true} />,
    );

    // Loader2 has animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows check icon when isValid is true", () => {
    const { container } = render(
      <RepoValidationInput {...defaultProps} isValid={true} />,
    );

    const checkIcon = container.querySelector(".text-green-500");
    expect(checkIcon).toBeInTheDocument();
  });

  it("shows X icon when isValid is false", () => {
    const { container } = render(
      <RepoValidationInput {...defaultProps} isValid={false} />,
    );

    const errorIcon = container.querySelector(".text-destructive");
    expect(errorIcon).toBeInTheDocument();
  });

  it("shows no status icon when isValid is null", () => {
    const { container } = render(
      <RepoValidationInput {...defaultProps} isValid={null} />,
    );

    expect(container.querySelector(".text-green-500")).not.toBeInTheDocument();
    expect(container.querySelector(".text-destructive")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("renders validMessage when provided", () => {
    render(
      <RepoValidationInput
        {...defaultProps}
        validMessage={<span>Valid repo: test/repo</span>}
      />,
    );

    expect(screen.getByText("Valid repo: test/repo")).toBeInTheDocument();
  });

  it("does not render validMessage when not provided", () => {
    render(<RepoValidationInput {...defaultProps} />);

    expect(
      screen.queryByText("Valid repo: test/repo"),
    ).not.toBeInTheDocument();
  });
});

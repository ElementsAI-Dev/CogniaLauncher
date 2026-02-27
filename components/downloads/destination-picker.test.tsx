import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { DestinationPicker } from "./destination-picker";

jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockOpen = jest.fn();
const mockSave = jest.fn();

jest.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => mockOpen(...args),
  save: (...args: unknown[]) => mockSave(...args),
}));

describe("DestinationPicker", () => {
  const defaultProps = {
    value: "",
    onChange: jest.fn(),
    placeholder: "/path/to/folder",
    label: "Destination",
    isDesktop: false,
    browseTooltip: "Browse folder",
    manualPathMessage: "Enter path manually",
    errorMessage: "Dialog failed",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders label, input, and browse button", () => {
    render(<DestinationPicker {...defaultProps} />);

    expect(screen.getByText("Destination")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("/path/to/folder"),
    ).toBeInTheDocument();
    // Browse button with FolderOpen icon
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("reflects value prop and calls onChange on typing", async () => {
    const onChange = jest.fn();
    render(
      <DestinationPicker {...defaultProps} value="/existing" onChange={onChange} />,
    );

    const input = screen.getByPlaceholderText("/path/to/folder");
    expect(input).toHaveValue("/existing");

    await userEvent.type(input, "/new");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows toast info when browse clicked in non-desktop mode", async () => {
    render(<DestinationPicker {...defaultProps} isDesktop={false} />);

    const browseButton = screen.getAllByRole("button")[0];
    await userEvent.click(browseButton);

    expect(toast.info).toHaveBeenCalledWith("Enter path manually");
  });

  it("does not show toast when manualPathMessage is undefined in non-desktop mode", async () => {
    render(
      <DestinationPicker
        {...defaultProps}
        isDesktop={false}
        manualPathMessage={undefined}
      />,
    );

    const browseButton = screen.getAllByRole("button")[0];
    await userEvent.click(browseButton);

    expect(toast.info).not.toHaveBeenCalled();
  });

  it("opens directory dialog in desktop directory mode", async () => {
    mockOpen.mockResolvedValue("/selected/dir");
    const onChange = jest.fn();

    render(
      <DestinationPicker
        {...defaultProps}
        isDesktop={true}
        mode="directory"
        onChange={onChange}
      />,
    );

    const browseButton = screen.getAllByRole("button")[0];
    await userEvent.click(browseButton);

    expect(mockOpen).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
    });
  });

  it("opens save dialog in desktop save mode", async () => {
    mockSave.mockResolvedValue("/selected/file.zip");
    const onChange = jest.fn();

    render(
      <DestinationPicker
        {...defaultProps}
        isDesktop={true}
        mode="save"
        defaultFileName="archive.zip"
        dialogTitle="Save As"
        onChange={onChange}
      />,
    );

    const browseButton = screen.getAllByRole("button")[0];
    await userEvent.click(browseButton);

    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "archive.zip",
      title: "Save As",
    });
  });

  it("shows error toast when dialog throws", async () => {
    mockOpen.mockRejectedValue(new Error("Dialog crashed"));
    render(
      <DestinationPicker
        {...defaultProps}
        isDesktop={true}
        mode="directory"
      />,
    );

    const browseButton = screen.getAllByRole("button")[0];
    await userEvent.click(browseButton);

    // Wait for error toast
    await screen.findByText("Destination");
    expect(toast.error).toHaveBeenCalledWith("Dialog failed");
  });
});

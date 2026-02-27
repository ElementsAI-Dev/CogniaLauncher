import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ArchiveFormatSelector,
  type ArchiveFormat,
} from "./archive-format-selector";

const defaultFormats: ArchiveFormat[] = [
  { value: "zip", label: "ZIP" },
  { value: "tar.gz", label: "TAR.GZ" },
  { value: "tar.bz2", label: "TAR.BZ2" },
];

describe("ArchiveFormatSelector", () => {
  const defaultProps = {
    format: "zip",
    onFormatChange: jest.fn(),
    formats: defaultFormats,
    idPrefix: "test-fmt",
    label: "Archive Format",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders label and all format options", () => {
    render(<ArchiveFormatSelector {...defaultProps} />);

    expect(screen.getByText("Archive Format:")).toBeInTheDocument();
    expect(screen.getByText("ZIP")).toBeInTheDocument();
    expect(screen.getByText("TAR.GZ")).toBeInTheDocument();
    expect(screen.getByText("TAR.BZ2")).toBeInTheDocument();
  });

  it("renders radio items with correct id attributes using idPrefix", () => {
    render(<ArchiveFormatSelector {...defaultProps} />);

    expect(
      document.getElementById("test-fmt-zip"),
    ).toBeInTheDocument();
    expect(
      document.getElementById("test-fmt-tar.gz"),
    ).toBeInTheDocument();
    expect(
      document.getElementById("test-fmt-tar.bz2"),
    ).toBeInTheDocument();
  });

  it("has the selected format checked", () => {
    render(<ArchiveFormatSelector {...defaultProps} format="tar.gz" />);

    const tarGzRadio = document.getElementById(
      "test-fmt-tar.gz",
    ) as HTMLButtonElement;
    expect(tarGzRadio).toHaveAttribute("data-state", "checked");
  });

  it("calls onFormatChange when selecting a different format", async () => {
    const onFormatChange = jest.fn();
    render(
      <ArchiveFormatSelector
        {...defaultProps}
        onFormatChange={onFormatChange}
      />,
    );

    await userEvent.click(screen.getByText("TAR.BZ2"));

    expect(onFormatChange).toHaveBeenCalledWith("tar.bz2");
  });

  it("renders nothing in radio group when formats array is empty", () => {
    render(
      <ArchiveFormatSelector {...defaultProps} formats={[]} />,
    );

    expect(screen.getByText("Archive Format:")).toBeInTheDocument();
    // No radio items rendered
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

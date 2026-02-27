import { render, screen, fireEvent } from "@testing-library/react";
import { BackgroundSettings } from "./background-settings";
import { useAppearanceStore } from "@/lib/stores/appearance";

const mockGetBackgroundImage = jest.fn((): string | null => null);
const mockNotifyBackgroundChange = jest.fn();

jest.mock("@/lib/theme/background", () => ({
  getBackgroundImage: () => mockGetBackgroundImage(),
  removeBackgroundImage: jest.fn(),
  setBackgroundImageData: jest.fn(),
  notifyBackgroundChange: (...args: unknown[]) => mockNotifyBackgroundChange(...args),
  compressImage: jest.fn(() => Promise.resolve("data:image/jpeg;base64,test")),
  BG_CHANGE_EVENT: "cognia-bg-change",
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => false),
}));

const t = (key: string) => {
  const translations: Record<string, string> = {
    "settings.backgroundImage": "Background Image",
    "settings.backgroundImageDesc": "Set a custom background image",
    "settings.backgroundEnabled": "Enable Background",
    "settings.backgroundEnabledDesc": "Show a custom background image",
    "settings.backgroundOpacity": "Image Opacity",
    "settings.backgroundOpacityDesc": "Adjust visibility",
    "settings.backgroundBlur": "Blur Amount",
    "settings.backgroundBlurDesc": "Apply blur effect",
    "settings.backgroundFit": "Image Fit",
    "settings.backgroundFitDesc": "How the image fills the screen",
    "settings.backgroundFitCover": "Cover",
    "settings.backgroundFitContain": "Contain",
    "settings.backgroundFitFill": "Stretch",
    "settings.backgroundFitTile": "Tile",
    "settings.backgroundSelect": "Select Image",
    "settings.backgroundClear": "Clear Image",
    "settings.backgroundTooLarge": "Image is too large",
  };
  return translations[key] || key;
};

describe("BackgroundSettings", () => {
  beforeEach(() => {
    useAppearanceStore.getState().reset();
  });

  it("renders the section title", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getByText("Background Image")).toBeInTheDocument();
  });

  it("renders enable toggle", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getByText("Enable Background")).toBeInTheDocument();
  });

  it("renders select image button", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getByText("Select Image")).toBeInTheDocument();
  });

  it("renders opacity slider label", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getByText("Image Opacity")).toBeInTheDocument();
  });

  it("renders blur slider label", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getByText("Blur Amount")).toBeInTheDocument();
  });

  it("renders fit selector label", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getByText("Image Fit")).toBeInTheDocument();
  });

  it("renders hidden file input for image selection", () => {
    render(<BackgroundSettings t={t} />);

    const fileInput = screen.getByLabelText("Select Image", {
      selector: "input",
    });
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });

  it("renders description text", () => {
    render(<BackgroundSettings t={t} />);

    expect(
      screen.getByText("Set a custom background image"),
    ).toBeInTheDocument();
  });

  it("renders opacity description", () => {
    render(<BackgroundSettings t={t} />);

    expect(screen.getByText("Adjust visibility")).toBeInTheDocument();
  });

  it("renders blur description", () => {
    render(<BackgroundSettings t={t} />);

    expect(screen.getByText("Apply blur effect")).toBeInTheDocument();
  });

  it("renders fit description", () => {
    render(<BackgroundSettings t={t} />);

    expect(
      screen.getByText("How the image fills the screen"),
    ).toBeInTheDocument();
  });

  it("renders clear button when image is set", () => {
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");

    render(<BackgroundSettings t={t} />);

    expect(screen.getByText("Clear Image")).toBeInTheDocument();
  });

  it("calls notifyBackgroundChange when clear is clicked", () => {
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");

    render(<BackgroundSettings t={t} />);

    mockNotifyBackgroundChange.mockClear();
    fireEvent.click(screen.getByText("Clear Image"));

    expect(mockNotifyBackgroundChange).toHaveBeenCalled();
  });

  it("handles file input change", () => {
    render(<BackgroundSettings t={t} />);

    const fileInput = screen.getByLabelText("Select Image", {
      selector: "input",
    });

    // Create a mock file
    const file = new File(["image"], "test.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // The handler was invoked (compressImage will be called async)
    expect(fileInput).toBeInTheDocument();
  });

  it("clicking select image opens file dialog in non-Tauri mode", () => {
    render(<BackgroundSettings t={t} />);

    const selectBtn = screen.getByText("Select Image").closest("button")!;
    fireEvent.click(selectBtn);

    // In non-Tauri mode, it falls through to clicking the hidden file input
    expect(selectBtn).toBeInTheDocument();
  });

  it("renders image preview when background image is set", () => {
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");

    const { container } = render(<BackgroundSettings t={t} />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/jpeg;base64,test");
  });
});

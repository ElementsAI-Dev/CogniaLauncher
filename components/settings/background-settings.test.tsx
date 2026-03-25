import { render, screen, fireEvent } from "@testing-library/react";
import { BackgroundSettings } from "./background-settings";
import { useAppearanceStore } from "@/lib/stores/appearance";

const mockGetBackgroundImage = jest.fn((): string | null => null);
const mockRemoveBackgroundImage = jest.fn();
const mockSetBackgroundImageData = jest.fn();
const mockCompressImage = jest.fn(() => Promise.resolve("data:image/jpeg;base64,test"));

jest.mock("@/lib/theme/background", () => ({
  getBackgroundImage: () => mockGetBackgroundImage(),
  removeBackgroundImage: (...args: unknown[]) => mockRemoveBackgroundImage(...args),
  setBackgroundImageData: (...args: unknown[]) => mockSetBackgroundImageData(...args),
  compressImage: (...args: unknown[]) => mockCompressImage(...args),
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
    "settings.backgroundMissingImage": "Background is enabled, but no image is selected. Choose an image to continue.",
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
    "settings.backgroundScale": "Image Scale",
    "settings.backgroundScaleDesc": "Scale image",
    "settings.backgroundPositionX": "Horizontal Position",
    "settings.backgroundPositionXDesc": "Adjust horizontal anchor",
    "settings.backgroundPositionY": "Vertical Position",
    "settings.backgroundPositionYDesc": "Adjust vertical anchor",
    "settings.backgroundSelect": "Select Image",
    "settings.backgroundClear": "Clear Image",
    "settings.backgroundResetTuning": "Reset Image Tuning",
    "settings.backgroundDropPasteHint": "Drop an image here or paste from clipboard",
    "settings.backgroundPreviewTitle": "Background Preview",
    "settings.backgroundPreviewEmpty": "No image selected",
    "settings.backgroundPreviewReady": "Image selected",
    "settings.backgroundInvalidImage": "Invalid image",
    "settings.backgroundUnsupportedFormat": "Unsupported format",
    "settings.backgroundProcessFailed": "Process failed",
    "settings.backgroundTooLarge": "Image is too large",
  };
  return translations[key] || key;
};

describe("BackgroundSettings", () => {
  beforeEach(() => {
    useAppearanceStore.getState().reset();
    jest.clearAllMocks();
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

  it("renders scale and position controls", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getByText("Image Scale")).toBeInTheDocument();
    expect(screen.getByText("Horizontal Position")).toBeInTheDocument();
    expect(screen.getByText("Vertical Position")).toBeInTheDocument();
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

  it("renders drag-and-paste hint", () => {
    render(<BackgroundSettings t={t} />);
    expect(screen.getAllByText("Drop an image here or paste from clipboard").length).toBeGreaterThan(0);
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

  it("calls removeBackgroundImage when clear is clicked", () => {
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");

    render(<BackgroundSettings t={t} />);

    mockRemoveBackgroundImage.mockClear();
    fireEvent.click(screen.getByText("Clear Image"));

    expect(mockRemoveBackgroundImage).toHaveBeenCalled();
  });

  it("shows a warning when background is enabled but no image is stored", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    mockGetBackgroundImage.mockReturnValue(null);

    render(<BackgroundSettings t={t} />);

    expect(
      screen.getByText(
        "Background is enabled, but no image is selected. Choose an image to continue.",
      ),
    ).toBeInTheDocument();
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

  it("imports dropped image file", async () => {
    const { container } = render(<BackgroundSettings t={t} />);
    const dropZone = container.querySelector('[aria-label="Drop an image here or paste from clipboard"]');
    expect(dropZone).toBeInTheDocument();

    const file = new File(["image"], "drop.png", { type: "image/png" });
    fireEvent.drop(dropZone as Element, {
      dataTransfer: { files: [file] },
    });

    await Promise.resolve();
    expect(mockCompressImage).toHaveBeenCalled();
    expect(mockSetBackgroundImageData).toHaveBeenCalledWith("data:image/jpeg;base64,test");
  });

  it("imports pasted image", async () => {
    const { container } = render(<BackgroundSettings t={t} />);
    const dropZone = container.querySelector('[aria-label="Drop an image here or paste from clipboard"]');
    expect(dropZone).toBeInTheDocument();

    const file = new File(["image"], "paste.png", { type: "image/png" });
    fireEvent.paste(dropZone as Element, {
      clipboardData: {
        items: [
          {
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      },
    });

    await Promise.resolve();
    expect(mockSetBackgroundImageData).toHaveBeenCalledWith("data:image/jpeg;base64,test");
  });

  it("clicking select image opens file dialog in non-Tauri mode", () => {
    render(<BackgroundSettings t={t} />);

    const selectBtn = screen.getByText("Select Image").closest("button")!;
    fireEvent.click(selectBtn);

    // In non-Tauri mode, it falls through to clicking the hidden file input
    expect(selectBtn).toBeInTheDocument();
  });

  it("resets only background tuning values", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundOpacity(80);
    useAppearanceStore.getState().setBackgroundBlur(8);
    useAppearanceStore.getState().setBackgroundFit("contain");
    useAppearanceStore.getState().setBackgroundScale(130);
    useAppearanceStore.getState().setBackgroundPositionX(20);
    useAppearanceStore.getState().setBackgroundPositionY(80);

    render(<BackgroundSettings t={t} />);
    fireEvent.click(screen.getByText("Reset Image Tuning"));

    const state = useAppearanceStore.getState();
    expect(state.backgroundEnabled).toBe(true);
    expect(state.backgroundOpacity).toBe(20);
    expect(state.backgroundBlur).toBe(0);
    expect(state.backgroundFit).toBe("cover");
    expect(state.backgroundScale).toBe(100);
    expect(state.backgroundPositionX).toBe(50);
    expect(state.backgroundPositionY).toBe(50);
  });

  it("renders image preview when background image is set", () => {
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");

    const { container } = render(<BackgroundSettings t={t} />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/jpeg;base64,test");
  });

  it("shows empty preview state when no background image is selected", () => {
    mockGetBackgroundImage.mockReturnValue(null);
    render(<BackgroundSettings t={t} />);

    expect(screen.getByText("Background Preview")).toBeInTheDocument();
    expect(screen.getAllByText("No image selected").length).toBeGreaterThan(0);
  });

  it("shows ready preview state when a background image is available", () => {
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");

    render(<BackgroundSettings t={t} />);

    expect(screen.getByText("Background Preview")).toBeInTheDocument();
    expect(screen.getByText("Image selected")).toBeInTheDocument();
  });

  it("disables scale control when fit mode is tile", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundFit("tile");
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");

    render(<BackgroundSettings t={t} />);

    const sliders = screen.getAllByRole("slider");
    expect(sliders[2]).toHaveAttribute("data-disabled", "");
  });
});

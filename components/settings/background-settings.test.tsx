import { render, screen } from "@testing-library/react";
import { BackgroundSettings } from "./background-settings";
import { useAppearanceStore } from "@/lib/stores/appearance";

jest.mock("@/lib/theme/background", () => ({
  getBackgroundImage: jest.fn(() => null),
  removeBackgroundImage: jest.fn(),
  setBackgroundImageData: jest.fn(),
  notifyBackgroundChange: jest.fn(),
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
});

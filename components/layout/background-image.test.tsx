import { render } from "@testing-library/react";
import { BackgroundImage } from "./background-image";
import { useAppearanceStore } from "@/lib/stores/appearance";

jest.mock("@/lib/theme/background", () => ({
  getBackgroundImage: jest.fn(() => null),
  removeBackgroundImage: jest.fn(),
  BG_CHANGE_EVENT: "cognia-bg-change",
}));

const mockGetBackgroundImage =
  jest.requireMock("@/lib/theme/background").getBackgroundImage;

describe("BackgroundImage", () => {
  beforeEach(() => {
    useAppearanceStore.getState().reset();
    mockGetBackgroundImage.mockReturnValue(null);
  });

  it("returns null when disabled", () => {
    const { container } = render(<BackgroundImage />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when enabled but no image", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    mockGetBackgroundImage.mockReturnValue(null);
    const { container } = render(<BackgroundImage />);
    expect(container.innerHTML).toBe("");
  });

  it("renders image div when enabled with image", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const divs = container.querySelectorAll("div");
    expect(divs.length).toBe(2);
  });

  it("applies blur style when blur > 0", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundBlur(5);
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const imageDiv = container.querySelector("div");
    expect(imageDiv?.style.filter).toBe("blur(5px)");
  });

  it("applies correct background-size for tile fit", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundFit("tile");
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const imageDiv = container.querySelector("div");
    expect(imageDiv?.style.backgroundSize).toBe("auto");
    expect(imageDiv?.style.backgroundRepeat).toBe("repeat");
  });
});

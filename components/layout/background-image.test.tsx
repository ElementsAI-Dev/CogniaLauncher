import { render, act } from "@testing-library/react";
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

  it("applies contain background-size for contain fit", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundFit("contain");
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const imageDiv = container.querySelector("div");
    expect(imageDiv?.style.backgroundSize).toBe("contain");
    expect(imageDiv?.style.backgroundRepeat).toBe("no-repeat");
  });

  it("applies 100% 100% background-size for fill fit", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundFit("fill");
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const imageDiv = container.querySelector("div");
    expect(imageDiv?.style.backgroundSize).toBe("100% 100%");
  });

  it("defaults to cover background-size for unknown fit", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    // cover is the default fit
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const imageDiv = container.querySelector("div");
    expect(imageDiv?.style.backgroundSize).toBe("cover");
  });

  it("sets inset to 0 and no filter when blur is 0", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundBlur(0);
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const imageDiv = container.querySelector("div");
    expect(imageDiv?.style.inset).toBe("0");
    expect(imageDiv?.style.filter).toBe("");
  });

  it("re-renders when BG_CHANGE_EVENT is dispatched", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    mockGetBackgroundImage.mockReturnValue(null);
    const { container } = render(<BackgroundImage />);
    // Initially no image
    expect(container.innerHTML).toBe("");

    // Simulate image becoming available via event
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,new");
    act(() => {
      window.dispatchEvent(new CustomEvent("cognia-bg-change"));
    });

    const divs = container.querySelectorAll("div");
    expect(divs.length).toBe(2);
  });

  it("applies correct overlay opacity based on backgroundOpacity", () => {
    useAppearanceStore.getState().setBackgroundEnabled(true);
    useAppearanceStore.getState().setBackgroundOpacity(60);
    mockGetBackgroundImage.mockReturnValue("data:image/jpeg;base64,test");
    const { container } = render(<BackgroundImage />);
    const overlayDiv = container.querySelectorAll("div")[1];
    // opacity = 1 - 60/100 = 0.4
    expect(overlayDiv?.style.opacity).toBe("0.4");
  });
});

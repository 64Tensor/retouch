import type { CanvasRenderer } from "../src/ui/editor/canvas-renderer";
import { createCropTool } from "../src/ui/editor/crop-tool";
import { cropToPixels } from "../src/utils/transform";

// jsdom has no PointerEvent: a MouseEvent carrying the pointer fields stands in.
function pointer(type: string, x: number, y: number): Event {
  return Object.assign(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
    { pointerId: 1, pointerType: "mouse" },
  );
}

/**
 * A 1600 × 1000 photo, shown at 799 × 500: the rect on screen is rounded to whole pixels, so it's
 * a little narrower than the photo.
 */
function setup() {
  const renderer = {
    getImageRect: () => ({ x: 0, y: 0, width: 799, height: 500 }),
    getScreenScale: () => 1,
    getVisibleAspect: () => 1600 / 1000,
  } as unknown as CanvasRenderer;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const tool = createCropTool({ container, renderer, onChange: () => {} });
  const handle = (pos: string) => container.querySelector(`.rt-crop__handle--${pos}`) as Element;
  return { tool, handle };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("crop aspect presets", () => {
  it("frame by the photo's own shape, not its rounded size on screen", () => {
    const { tool } = setup();
    tool.setAspectRatio("1:1");
    expect(cropToPixels(tool.getSelection(), 1600, 1000)).toEqual({
      x: 300,
      y: 0,
      width: 1000,
      height: 1000,
    });
    tool.setAspectRatio("16:9");
    expect(cropToPixels(tool.getSelection(), 1600, 1000)).toEqual({
      x: 0,
      y: 50,
      width: 1600,
      height: 900,
    });
  });

  it("keep the shape while a corner is pulled", () => {
    const { tool, handle } = setup();
    tool.setAspectRatio("1:1");
    const corner = handle("se");
    corner.dispatchEvent(pointer("pointerdown", 649, 500));
    document.dispatchEvent(pointer("pointermove", 599, 450));
    document.dispatchEvent(pointer("pointermove", 549, 400));
    document.dispatchEvent(pointer("pointerup", 549, 400));
    const { width, height } = cropToPixels(tool.getSelection(), 1600, 1000);
    expect(height).toBeLessThan(1000);
    expect(width).toBe(height);
  });
});

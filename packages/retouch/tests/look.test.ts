import { DEFAULT_EDITS } from "../src/constants";
import { applyLook, renderLook } from "../src/look";

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe("applyLook", () => {
  it("changes only what the look names", () => {
    const edits = structuredClone(DEFAULT_EDITS);
    edits.adjustments.contrast = 120;
    edits.hsl.orange = { h: 5, s: 10, l: 0 };
    edits.curves.r = [
      { x: 0, y: 0.1 },
      { x: 1, y: 1 },
    ];

    applyLook(edits, {
      adjustments: { dehaze: 40 },
      hsl: { orange: { s: 30 }, red: { h: -10 } },
      curves: {
        master: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.6 },
          { x: 1, y: 1 },
        ],
      },
      filter: "warm",
    });

    expect(edits.adjustments.dehaze).toBe(40);
    expect(edits.adjustments.contrast).toBe(120);
    expect(edits.hsl.orange).toEqual({ h: 5, s: 30, l: 0 });
    expect(edits.hsl.red).toEqual({ h: -10, s: 0, l: 0 });
    expect(edits.curves.master).toHaveLength(3);
    expect(edits.curves.r[0].y).toBe(0.1);
    expect(edits.filter).toBe("warm");
    expect(edits.filterStrength).toBe(100);
  });

  it("copies what it lays down, so the look can be used again unchanged", () => {
    const look = {
      adjustments: { exposure: 10 },
      curves: {
        master: [
          { x: 0, y: 0 },
          { x: 1, y: 0.9 },
        ],
      },
    };
    const edits = structuredClone(DEFAULT_EDITS);
    applyLook(edits, look);
    edits.adjustments.exposure = 99;
    edits.curves.master[1].y = 0.5;
    expect(look.adjustments.exposure).toBe(10);
    expect(look.curves.master[1].y).toBe(0.9);
  });
});

describe("renderLook", () => {
  it("draws at the source's size by default", () => {
    const out = renderLook(canvasOf(320, 200), { adjustments: { exposure: 20 } });
    expect([out.width, out.height]).toEqual([320, 200]);
  });

  it("caps the long edge, and never enlarges", () => {
    const capped = renderLook(canvasOf(2000, 1000), {}, { maxDimension: 500 });
    expect([capped.width, capped.height]).toEqual([500, 250]);
    const small = renderLook(canvasOf(300, 600), {}, { maxDimension: 1200 });
    expect([small.width, small.height]).toEqual([300, 600]);
  });

  it("takes partial settings, filling the rest with neutral ones", () => {
    expect(() =>
      renderLook(canvasOf(64, 64), {
        hsl: { blue: { s: -40 } },
        curves: {
          g: [
            { x: 0, y: 0.05 },
            { x: 1, y: 1 },
          ],
        },
        stylize: { kind: "duotone" },
        filter: "bw",
        filterStrength: 60,
      }),
    ).not.toThrow();
  });
});

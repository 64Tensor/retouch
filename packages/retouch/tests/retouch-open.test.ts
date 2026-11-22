import { Retouch } from "../src/retouch";
import type { MediaEntry } from "../src/types";
import { stubLayout } from "./editor-helpers";

// jsdom decodes no images, so files become entries here without loading.
vi.mock("../src/utils/image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/image")>();
  const { DEFAULT_EDITS } = await import("../src/constants");
  return {
    ...actual,
    revokeThumbnailUrl: vi.fn(),
    processFiles: async (files: File[]) => {
      const entries: MediaEntry[] = files.map((file) => {
        const image = new Image();
        Object.defineProperty(image, "naturalWidth", { value: 1200 });
        Object.defineProperty(image, "naturalHeight", { value: 800 });
        return {
          kind: "image",
          id: `id-${file.name}`,
          file,
          image,
          thumbnailUrl: `blob:${file.name}`,
          edits: structuredClone(DEFAULT_EDITS),
          edited: false,
        };
      });
      return { entries, rejected: [] };
    },
  };
});

const activeTool = () =>
  document.querySelector('.rt-toolbar__btn[aria-current="true"]')?.getAttribute("aria-label");

describe("Retouch.openEditor", () => {
  let restoreLayout: () => void;
  let retouch: Retouch;

  beforeEach(async () => {
    restoreLayout = stubLayout(800, 600);
    const container = document.createElement("div");
    document.body.appendChild(container);
    retouch = new Retouch({ target: container });
    await retouch.addFiles([new File(["x"], "a.png", { type: "image/png" })]);
  });

  afterEach(() => {
    retouch.destroy();
    document.body.innerHTML = "";
    restoreLayout();
  });

  it("opens on the tool asked for, and on the first tool next time", () => {
    retouch.openEditor("id-a.png", { tool: "adjust" });
    expect(activeTool()).toBe("Adjust");

    retouch.closeEditor(false);
    retouch.openEditor("id-a.png");
    expect(activeTool()).toBe("Crop");
  });

  it("starts from a look as one step: Undo takes it back, and Cancel leaves the photo alone", () => {
    const entry = retouch.getMedia()[0];
    entry.edits.adjustments.contrast = 110;

    retouch.openEditor(entry.id, {
      tool: "adjust",
      look: { adjustments: { dehaze: 35 }, hsl: { orange: { s: 25 } } },
    });
    expect(entry.edits.adjustments.dehaze).toBe(35);
    expect(entry.edits.adjustments.contrast).toBe(110);
    expect(entry.edits.hsl.orange.s).toBe(25);

    const undo = document.querySelector<HTMLButtonElement>('[aria-label^="Undo"]');
    expect(undo?.disabled).toBe(false);
    undo?.click();
    expect(entry.edits.adjustments.dehaze).toBe(0);
    expect(entry.edits.adjustments.contrast).toBe(110);

    retouch.closeEditor(false);
    retouch.openEditor(entry.id, { look: { adjustments: { dehaze: 35 } } });
    retouch.closeEditor(false);
    expect(entry.edits.adjustments.dehaze).toBe(0);
    expect(entry.edited).toBe(false);
  });

  it("keeps the look when Done is pressed", () => {
    const entry = retouch.getMedia()[0];
    retouch.openEditor(entry.id, { look: { filter: "warm", filterStrength: 70 } });
    retouch.closeEditor(true);
    expect(entry.edited).toBe(true);
    expect(entry.edits.filter).toBe("warm");
    expect(entry.edits.filterStrength).toBe(70);
  });
});

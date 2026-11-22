import {
  createDefaultCurves,
  createDefaultHsl,
  createDefaultStylize,
  DEFAULT_ADJUSTMENTS,
} from "./constants";
import type {
  Adjustments,
  Curves,
  FilterPreset,
  HslBand,
  HslMixer,
  HslShift,
  StylizeEffect,
} from "./types";
import { createPreviewBase, type LookEdits, renderLookToCanvas } from "./ui/editor/preview";

/**
 * Tone and color settings, every one optional: what `renderLook()` draws and what
 * `openEditor(id, { look })` starts from. Geometry (crop, rotation, perspective) isn't part of
 * a look.
 */
export interface Look {
  /** Only the sliders named change; the rest stay where they are. */
  adjustments?: Partial<Adjustments>;
  filter?: FilterPreset;
  /** The filter's strength, 0–100. */
  filterStrength?: number;
  /** Tone curves by channel, each a list of points from (0, 0) to (1, 1). */
  curves?: Partial<Curves>;
  /** The color mixer by band, as shifts of hue, saturation and lightness, each -100 to 100. */
  hsl?: Partial<Record<HslBand, Partial<HslShift>>>;
  stylize?: Partial<StylizeEffect>;
}

/** What `renderLook()` can draw from. */
export type LookSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;

export interface RenderLookOptions {
  /**
   * Cap the long edge in pixels; the source is never enlarged. Rendering runs passes over every
   * pixel, so a cap keeps it quick: a 1600-pixel photo takes tens of milliseconds, a 6000-pixel
   * one far longer. No cap by default.
   */
  maxDimension?: number;
}

/** The parts of an entry's edits a look touches. */
type LookTarget = {
  adjustments: Adjustments;
  filter: FilterPreset;
  filterStrength: number;
  curves: Curves;
  hsl: HslMixer;
  stylize: StylizeEffect;
};

/**
 * Lay `look` over `edits`, in place: the sliders, curve channels and color bands it names
 * replace theirs, and everything else is kept.
 */
export function applyLook(edits: LookTarget, look: Look): void {
  if (look.adjustments) edits.adjustments = { ...edits.adjustments, ...look.adjustments };
  if (look.filter !== undefined) edits.filter = look.filter;
  if (look.filterStrength !== undefined) edits.filterStrength = look.filterStrength;
  if (look.curves) {
    const curves = { ...edits.curves };
    for (const channel of ["master", "r", "g", "b"] as const) {
      const points = look.curves[channel];
      if (points) curves[channel] = points.map((p) => ({ x: p.x, y: p.y }));
    }
    edits.curves = curves;
  }
  if (look.hsl) {
    const hsl = { ...edits.hsl };
    for (const [band, shift] of Object.entries(look.hsl) as [HslBand, Partial<HslShift>][]) {
      if (shift && band in hsl) hsl[band] = { ...hsl[band], ...shift };
    }
    edits.hsl = hsl;
  }
  if (look.stylize) edits.stylize = { ...edits.stylize, ...look.stylize };
}

/** A look's settings with every gap filled with the neutral one. */
function resolveLook(look: Look): LookEdits {
  const edits: LookTarget = {
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    filter: "none",
    filterStrength: 100,
    curves: createDefaultCurves(),
    hsl: createDefaultHsl(),
    stylize: createDefaultStylize(),
  };
  applyLook(edits, look);
  return edits;
}

/**
 * `source` with `look` applied, through the editor's own rendering pipeline, so it's exactly
 * what Rétouch shows for those settings. For thumbnails, previews of saved settings, or a
 * video graded frame by frame. Transparency is kept.
 *
 * ```ts
 * const canvas = renderLook(img, { adjustments: { dehaze: 40, exposure: 10 } }, { maxDimension: 1600 });
 * ```
 */
export function renderLook(
  source: LookSource,
  look: Look,
  options: RenderLookOptions = {},
): HTMLCanvasElement {
  const size = options.maxDimension ?? Number.POSITIVE_INFINITY;
  return renderLookToCanvas(createPreviewBase(source, size), resolveLook(look));
}

import { injectStyles } from "../src/styles";

describe("injectStyles", () => {
  it("puts the token layer first in <head> and the component rules last, once", () => {
    const hostSheet = document.createElement("style");
    hostSheet.id = "host";
    document.head.appendChild(hostSheet);

    injectStyles();
    injectStyles();

    const ids = [...document.head.querySelectorAll("style")].map((s) => s.id);
    expect(ids).toEqual(["rt-tokens", "host", "rt-styles"]);

    const tokens = document.getElementById("rt-tokens")?.textContent ?? "";
    const rules = document.getElementById("rt-styles")?.textContent ?? "";
    expect(tokens).toContain("@layer retouch-tokens");
    // Component rules stay unlayered so host resets can't outrank them.
    expect(rules).not.toContain("@layer");
    // The shell's dark set applies by option, or by OS preference under auto.
    expect(tokens).toContain('.rt-root[data-rt-theme="dark"]');
    expect(tokens).toMatch(/prefers-color-scheme: dark\)\s*\{\s*\.rt-root\[data-rt-theme="auto"\]/);
  });

  it("turns all of its motion off under reduced motion, delays and view transitions included", () => {
    injectStyles();
    const rules = document.getElementById("rt-styles")?.textContent ?? "";
    const reduced = rules.slice(rules.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    for (const rule of [
      "animation-duration: 0.01ms !important",
      "animation-delay: 0s !important",
      "transition-duration: 0.01ms !important",
      "transition-delay: 0s !important",
      "html.rt-morphing::view-transition-group(*)",
    ]) {
      expect(reduced).toContain(rule);
    }
    for (const scope of [
      ".rt-root *",
      ".rt-editor-overlay *",
      ".rt-export-overlay *",
      ".rt-toasts *",
    ]) {
      expect(reduced).toContain(scope);
    }
  });
  it("keeps Cancel clear of the title, and compacts the top bar by its own width", () => {
    injectStyles();
    const rules = document.getElementById("rt-styles")?.textContent ?? "";
    const rule = (selector: string) => {
      const at = rules.indexOf(`${selector} {`);
      return rules.slice(at, rules.indexOf("}", at));
    };
    // A size container, so the bar compacts in a narrow column of a wide page too.
    expect(rule(".rt-editor__topbar")).toContain("container: rt-topbar / inline-size");
    // Cancel's group can't shrink below Cancel and the activity's ring. With min-width: 0 it
    // shrank to nothing at medium widths, and the file name slid under Cancel.
    const left = rule(".rt-editor__topbar-left");
    expect(left).toContain("display: grid");
    expect(left).toContain("grid-auto-columns: minmax(30px, max-content)");
    expect(left).not.toMatch(/min-width:\s*0/);
    // Too narrow for every label: the size chip, the Download label and the button labels go.
    const compact = rules.slice(rules.indexOf("@container rt-topbar (max-width: 840px)"));
    const hidden = compact.slice(0, compact.indexOf("}"));
    for (const selector of [
      ".rt-editor__dimensions",
      ".rt-download__label",
      ".rt-editor__compare-btn span",
      ".rt-editor__text-btn span",
      ".rt-activity__label",
    ]) {
      expect(hidden).toContain(selector);
    }
    // Squeezed to its ring, the activity wraps Stop out of sight instead of cutting it in half.
    const activity = rule(".rt-activity");
    expect(activity).toContain("flex-wrap: wrap");
    expect(activity).toContain("overflow: clip");
    // And on the smallest phones, the format beside Download goes so Download stays clear of Done.
    const tiny = rules.slice(rules.indexOf("@container rt-topbar (max-width: 360px)"));
    expect(tiny.slice(0, tiny.indexOf("}"))).toContain(".rt-download__format");
  });
});

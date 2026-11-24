import { defineConfig } from "tsdown";

// The main process as ESM, and the preload script as CommonJS, which a sandboxed window needs.
// Electron itself is the only import left: everything else is bundled.
export default defineConfig([
  {
    entry: { main: "src/main/main.ts" },
    outDir: "dist/main",
    format: "esm",
    platform: "node",
    target: "node22",
    fixedExtension: false,
    deps: { neverBundle: ["electron"] },
    clean: true,
  },
  {
    entry: { preload: "src/preload/preload.ts" },
    outDir: "dist/preload",
    format: "cjs",
    platform: "node",
    target: "node22",
    fixedExtension: false,
    deps: { neverBundle: ["electron"] },
    clean: true,
  },
]);

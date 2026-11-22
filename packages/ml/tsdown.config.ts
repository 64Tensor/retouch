import { defineConfig } from "tsdown";

// ESM only, for the browser. Rétouch and ONNX Runtime stay external: Rétouch is a peer, and ONNX
// Runtime has to stay behind a dynamic import (scripts/smoke.mjs checks that it does).
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@64tensor/retouch", "onnxruntime-web"],
});

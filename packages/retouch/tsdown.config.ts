import { defineConfig } from "tsdown";

// ESM only, for the browser. One file and its types, with source maps; the runtime dependencies stay
// external, so an app bundles one copy of each.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
});

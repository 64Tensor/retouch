// The window's page: the editor, its ML tools and Settings, built into dist/renderer, which the
// main process serves as app://retouch/. ONNX Runtime ships inside the app, so the ML tools never
// load it from a CDN: Vite emits the .wasm binary the runtime's bundle points at, it lands in ort/
// under its own name, and the script that starts it in the runtime's worker goes beside it.
// installMlTools' wasmPaths sends the runtime there.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const here = import.meta.dirname;
const ORT_BINARY = /^ort-wasm-simd-threaded.*\.wasm$/;

/** Beside each runtime binary, its .mjs, from the same onnxruntime-web retouch-ml imports. */
function ortRuntime(): Plugin {
  return {
    name: "ort-runtime",
    apply: "build",
    generateBundle(_options, bundle) {
      const binaries = Object.keys(bundle).filter((file) => /^ort\/.+\.wasm$/.test(file));
      if (binaries.length === 0) this.error("ONNX Runtime's .wasm binary wasn't emitted into ort/");
      const fromMl = createRequire(join(here, "../packages/ml/package.json"));
      const dist = dirname(fromMl.resolve("onnxruntime-web"));
      for (const binary of binaries) {
        const script = binary.replace(/\.wasm$/, ".mjs");
        const source = readFileSync(join(dist, script.slice("ort/".length)));
        this.emitFile({ type: "asset", fileName: script, source });
      }
    },
  };
}

export default defineConfig({
  root: resolve(here, "src/renderer"),
  base: "./",
  build: {
    outDir: resolve(here, "dist/renderer"),
    emptyOutDir: true,
    target: "esnext",
    // The ML runtime is large on purpose: it's the whole of ONNX Runtime, loaded on first use.
    chunkSizeWarningLimit: 4096,
    rolldownOptions: {
      output: {
        assetFileNames: ({ names }) =>
          ORT_BINARY.test(names[0] ?? "") ? "ort/[name][extname]" : "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [ortRuntime()],
});

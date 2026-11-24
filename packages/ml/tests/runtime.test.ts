import { afterEach, describe, expect, it, vi } from "vitest";

// ONNX Runtime and the model download, stood in for: only where the binaries load from matters.
const ort = vi.hoisted(() => ({
  env: { wasm: {} as { wasmPaths?: string; proxy?: boolean }, versions: { web: "1.31.1" } },
  InferenceSession: { create: vi.fn(async () => ({})) },
}));
vi.mock("onnxruntime-web", () => ort);
vi.mock("../src/model-cache", () => ({ fetchModel: vi.fn(async () => new ArrayBuffer(8)) }));

import { loadSession, setWasmPaths } from "../src/runtime";

describe("where ONNX Runtime's binaries load from", () => {
  afterEach(() => setWasmPaths(undefined));

  it("is the shared directory when one is set, and a tool's own when it names one", async () => {
    setWasmPaths("app://retouch/ort/");
    await loadSession("https://example.com/a.onnx");
    expect(ort.env.wasm.wasmPaths).toBe("app://retouch/ort/");

    await loadSession("https://example.com/b.onnx", { wasmPaths: "/own/" });
    expect(ort.env.wasm.wasmPaths).toBe("/own/");
  });
});

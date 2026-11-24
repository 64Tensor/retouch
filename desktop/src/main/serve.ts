// The window's pages come from app://retouch/, a private origin served from the files inside the
// app. A real origin (not file://) gives modules, workers and WebAssembly what a website gets, and
// the headers below lock it down: nothing loads from elsewhere except the ML models.

import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { protocol } from "electron";

export const APP_ORIGIN = "app://retouch";

/** Call before the app is ready, so the scheme behaves like https. */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        codeCache: true,
      },
    },
  ]);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

// The ML tools download their models from Hugging Face, which redirects to its storage hosts,
// and face detection's from its author's GitHub repository (retouch-ml's DEFAULT_*_MODEL_URL).
// Model requests for Ask AI don't appear here: the main process makes them (model.ts).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

/** Serve `root` at app://retouch/. */
export function serveApp(root: string): void {
  const base = normalize(root) + sep;
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = normalize(join(base, path));
    if (url.host !== "retouch" || !file.startsWith(base)) return notFound();
    let body: Buffer;
    try {
      body = await readFile(file);
    } catch {
      return notFound();
    }
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        "content-security-policy": CSP,
        // Cross-origin isolation lets ONNX Runtime run on several threads.
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff",
      },
    });
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
}

---
"@64tensor/retouch": minor
"@64tensor/retouch-ml": minor
---

Two hooks for apps that host Rétouch in a window of their own, such as a desktop app:

- `ai.fetch` replaces the `fetch` Ask AI's built-in call uses. An app can send the request from its own code, for example a desktop app's main process, which needs no CORS from the server and can add the key itself, so the page never holds it.
- `installMlTools(retouch, { wasmPaths })` sets where ONNX Runtime's `.wasm` binaries load from for every ML tool at once, so an app can ship them rather than load them from jsDelivr. It was already an option of each tool.

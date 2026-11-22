// The playground: the editor, straight from the workspace source, and nothing else. Vite reloads
// it as you change packages/*/src. The full demo, with sample photos and the landing page, is
// retouch.64tensor.com, which uses the published packages like any other app.

import { Retouch, VERSION } from "@64tensor/retouch";

const ml = document.querySelector<HTMLInputElement>("#ml");
const version = document.querySelector<HTMLElement>("#version");
if (version) version.textContent = `v${VERSION}`;

// The ML tools come and go with the checkbox; the choice survives a reload.
const withMl = new URLSearchParams(location.search).has("ml");
if (ml) {
  ml.checked = withMl;
  ml.addEventListener("change", () => {
    const url = new URL(location.href);
    if (ml.checked) url.searchParams.set("ml", "");
    else url.searchParams.delete("ml");
    location.href = url.href;
  });
}

const retouch = new Retouch({
  target: "#editor",
  theme: "auto",
  onDone: (blobs) => {
    for (const blob of blobs) console.log("done", blob.type, `${blob.size} bytes`, blob);
  },
});

if (withMl) {
  const { installMlTools } = await import("@64tensor/retouch-ml");
  installMlTools(retouch);
}

// For poking at it from the console.
Object.assign(window, { retouch });

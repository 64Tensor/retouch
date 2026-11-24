// The window: the editor and its ML tools filling it, a bar with the model in use, and Settings.
// Ask AI's options are one object the settings rewrite in place, so a new model applies without
// a restart; its requests go through the main process (window.retouchApp.fetch).

import { type AiOptions, Retouch } from "@64tensor/retouch";
import { installMlTools } from "@64tensor/retouch-ml";
import { type FileData, type PublicSettings, SETTINGS_URL } from "../shared/api";
import { bridge, plain } from "./bridge";
import { connected, createSettings, modelName } from "./settings";
import "./app.css";

/** Stands in for a stored key, so Ask AI knows there is one: the main process sends the real one. */
const STORED_KEY = "stored-in-keychain";

const ai: AiOptions = {
  fetch: viaMainProcess,
  notice: {
    text: "Ask AI needs a language model. Choose one in Settings: Ollama or LM Studio on this Mac, or your own provider.",
    links: [
      { label: "Open Settings", href: SETTINGS_URL },
      { label: "How to connect a model", href: "https://64tensor.com/retouch/docs/ai" },
    ],
  },
};

/** A built-in call's request, made by the main process. */
async function viaMainProcess(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, name) => {
    headers[name] = value;
  });
  const body = typeof init.body === "string" ? init.body : undefined;
  try {
    const answer = await bridge.fetch({ url, method: init.method ?? "GET", headers, body });
    const empty = answer.status === 204 || answer.status === 304;
    return new Response(empty ? null : answer.body, {
      status: answer.status,
      statusText: answer.statusText,
      headers: answer.headers,
    });
  } catch (error) {
    throw new Error(plain(error));
  }
}

function apply(settings: PublicSettings): void {
  Object.assign(ai, {
    provider: undefined,
    baseUrl: undefined,
    model: undefined,
    apiKey: undefined,
    sendImage: settings.sendImage,
  });
  if (!connected(settings)) return;
  if (settings.provider === "anthropic") {
    ai.provider = "anthropic";
  } else {
    ai.provider = "openai";
    ai.baseUrl = settings.baseUrl;
  }
  if (settings.hasKey) ai.apiKey = STORED_KEY;
  if (settings.model) ai.model = settings.model;
}

const retouch = new Retouch({
  target: "#editor",
  theme: "dark",
  rail: { expanded: true },
  // Done keeps each photo's edits adjustable, rather than baking them in.
  commitMode: "keep-edits",
  ai,
  onDone: (blobs) => void saveResults(blobs),
});

// The ML tools, with ONNX Runtime's binaries from inside the app rather than a CDN.
installMlTools(retouch, { wasmPaths: new URL("./ort/", location.href).href });

// ── Saving: Done exports every photo, and the app asks where to put them ──

const exported = new WeakMap<Blob, string>();
retouch.on("export:complete", ({ id, blob }) => exported.set(blob, id));

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

async function saveResults(blobs: Blob[]): Promise<void> {
  const media = retouch.getMedia();
  const files: FileData[] = await Promise.all(
    blobs.map(async (blob, index) => {
      const entry = media.find((m) => m.id === exported.get(blob));
      const name = entry?.file.name ?? `Rétouch ${index + 1}`;
      const ext = EXTENSIONS[blob.type] ?? "";
      return {
        name: name.replace(/\.[^.]+$/, "") + ext,
        type: blob.type,
        data: await blob.arrayBuffer(),
      };
    }),
  );
  try {
    const result = await bridge.saveFiles(files);
    if (result) say(result.saved === 1 ? "Saved" : `Saved ${result.saved} files`);
  } catch (error) {
    say(plain(error));
  }
}

let quiet: ReturnType<typeof setTimeout> | undefined;
function say(text: string): void {
  const status = document.querySelector<HTMLElement>(".bar__status");
  if (!status) return;
  status.textContent = text;
  clearTimeout(quiet);
  quiet = setTimeout(() => {
    status.textContent = "";
  }, 4000);
}

// ── The model: the bar shows it, Settings changes it ──

const button = document.querySelector<HTMLButtonElement>("#model");
const label = button?.querySelector<HTMLElement>(".bar__label");

function show(settings: PublicSettings): void {
  if (label) label.textContent = modelName(settings);
  button?.classList.toggle("is-connected", connected(settings));
}

let current = await bridge.loadSettings();
apply(current);
show(current);

const settings = createSettings(bridge, (saved) => {
  const changed = connected(saved) !== connected(current);
  current = saved;
  apply(saved);
  show(saved);
  // An open editor decided at opening whether Ask AI takes commands: open it again, edits kept.
  const editing = retouch.getEditingEntry();
  if (changed && editing) {
    retouch.closeEditor(true);
    retouch.openEditor(editing.id);
  }
});

button?.addEventListener("click", () => settings.open(current));
bridge.onOpenSettings(() => settings.open(current));
bridge.onOpenFiles((files) => {
  void retouch.addFiles(files.map((f) => new File([f.data], f.name, { type: f.type })));
});

// For the tests and for poking at it in development.
Object.assign(window, { retouch });

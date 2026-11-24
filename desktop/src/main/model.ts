// Ask AI's requests, made here rather than in the window. A request from the main process carries
// no Origin, so Ollama, LM Studio and any other server answer without a CORS setting, and the key
// is added here, so the window never holds it. Only the model set in Settings can be reached.

import { net } from "electron";
import type { ModelList, ModelQuery, ModelRequest, ModelResponse, Provider } from "../shared/api";
import { baseUrlOf, keyFor, loadSettings } from "./settings";

/** Headers the window may send on; the key and anything browser-only are dropped. */
const PASSED = new Set(["content-type", "accept", "anthropic-version", "anthropic-beta"]);

export async function modelFetch(request: ModelRequest): Promise<ModelResponse> {
  const settings = loadSettings();
  const base = settings.baseUrl;
  if (settings.provider === "none" || !base) {
    throw new Error("Choose a model in Settings first.");
  }
  if (!request.url.startsWith(`${base}/`)) {
    throw new Error("Rétouch only sends requests to the model chosen in Settings.");
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (PASSED.has(name.toLowerCase())) headers.set(name, value);
  }
  authorize(headers, settings.provider, keyFor());
  const response = await reach(base, () =>
    net.fetch(request.url, { method: request.method, headers, body: request.body }),
  );
  // The body goes back as text, already decoded, so its encoding and length no longer apply.
  const answer = Object.fromEntries(response.headers);
  delete answer["content-encoding"];
  delete answer["content-length"];
  return {
    status: response.status,
    statusText: response.statusText,
    headers: answer,
    body: await response.text(),
  };
}

/** The models a server or provider offers, to choose from in Settings. */
export async function listModels(query: ModelQuery): Promise<ModelList> {
  const base = baseUrlOf(query.provider, query.baseUrl);
  if (query.provider === "none" || !base) return { models: [] };
  const headers = new Headers({ accept: "application/json" });
  const key = query.key?.trim() || keyFor(query.provider);
  if (query.provider === "anthropic") headers.set("anthropic-version", "2023-06-01");
  authorize(headers, query.provider, key);
  const url = query.provider === "anthropic" ? `${base}/v1/models` : `${base}/models`;
  try {
    const response = await reach(base, () => net.fetch(url, { headers }));
    if (!response.ok) {
      const text = await response.text();
      return { models: [], error: messageOf(text) ?? `${response.status} ${response.statusText}` };
    }
    const data = (await response.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? []).flatMap((m) => (typeof m.id === "string" ? [m.id] : []));
    return { models: models.sort((a, b) => a.localeCompare(b)) };
  } catch (error) {
    return { models: [], error: error instanceof Error ? error.message : String(error) };
  }
}

function authorize(headers: Headers, provider: Provider, key: string | undefined): void {
  if (!key) return;
  if (provider === "anthropic") headers.set("x-api-key", key);
  else headers.set("authorization", `Bearer ${key}`);
}

/** A request, with a plain answer when nothing is listening at the address. */
async function reach(base: string, send: () => Promise<Response>): Promise<Response> {
  try {
    return await send();
  } catch (error) {
    const text = String(error instanceof Error ? error.message : error);
    if (
      /ERR_CONNECTION_REFUSED|ECONNREFUSED|ERR_ADDRESS_UNREACHABLE|ERR_NAME_NOT_RESOLVED/.test(text)
    ) {
      throw new Error(`Nothing answered at ${base}. Is the server running?`);
    }
    throw error;
  }
}

function messageOf(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { error?: string | { message?: string } };
    return typeof body.error === "string" ? body.error : body.error?.message;
  } catch {
    return text.trim().slice(0, 200) || undefined;
  }
}

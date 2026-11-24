// Ask AI's model, kept on this Mac: a small JSON file in the app's folder, with each provider's
// key encrypted by the system (the Keychain on a Mac). The window never sees a key again once
// it's saved; the main process adds it to the model's requests itself.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, safeStorage } from "electron";
import type { Provider, PublicSettings, SettingsInput } from "../shared/api";

interface Stored {
  provider: Provider;
  baseUrl?: string;
  model?: string;
  sendImage: boolean;
  /** Encrypted keys, base64, by provider. */
  keys: Partial<Record<Provider, string>>;
}

const PROVIDERS: Provider[] = ["none", "ollama", "lmstudio", "server", "openai", "anthropic"];

/** The API root each provider starts from. A server of your own has none until you say. */
export const DEFAULT_BASE_URL: Partial<Record<Provider, string>> = {
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
};

const EMPTY: Stored = { provider: "none", sendImage: true, keys: {} };

function file(): string {
  return join(app.getPath("userData"), "settings.json");
}

function read(): Stored {
  try {
    const raw = JSON.parse(readFileSync(file(), "utf8")) as Partial<Stored>;
    const provider = PROVIDERS.includes(raw.provider as Provider)
      ? (raw.provider as Provider)
      : "none";
    return {
      provider,
      baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : undefined,
      model: typeof raw.model === "string" ? raw.model : undefined,
      sendImage: raw.sendImage !== false,
      keys: typeof raw.keys === "object" && raw.keys ? raw.keys : {},
    };
  } catch {
    return { ...EMPTY, keys: {} };
  }
}

function write(settings: Stored): void {
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
}

/** The provider's API root: the default, or the address given for a server of your own. */
export function baseUrlOf(provider: Provider, given?: string): string | undefined {
  if (provider === "server" || provider === "ollama" || provider === "lmstudio") {
    return (given?.trim() || DEFAULT_BASE_URL[provider])?.replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL[provider];
}

export function loadSettings(): PublicSettings {
  const stored = read();
  return {
    provider: stored.provider,
    baseUrl: baseUrlOf(stored.provider, stored.baseUrl),
    model: stored.model,
    sendImage: stored.sendImage,
    hasKey: Boolean(stored.keys[stored.provider]),
    keys: PROVIDERS.filter((provider) => stored.keys[provider]),
  };
}

export function saveSettings(input: SettingsInput): PublicSettings {
  if (!PROVIDERS.includes(input.provider)) throw new Error("Unknown provider");
  const stored = read();
  const baseUrl = baseUrlOf(input.provider, input.baseUrl);
  if (baseUrl && !/^https?:\/\/[^/]+/.test(baseUrl)) {
    throw new Error("The address should start with http:// or https://");
  }
  const next: Stored = {
    provider: input.provider,
    baseUrl:
      input.provider === "server" || input.provider === "ollama" || input.provider === "lmstudio"
        ? baseUrl
        : undefined,
    model: input.model?.trim() || undefined,
    sendImage: input.sendImage,
    keys: { ...stored.keys },
  };
  if (input.key === null) delete next.keys[input.provider];
  else if (typeof input.key === "string" && input.key.trim()) {
    next.keys[input.provider] = encrypt(input.key.trim());
  }
  write(next);
  return loadSettings();
}

/** The stored key for the current provider, or for `provider`, decrypted; undefined if none. */
export function keyFor(provider?: Provider): string | undefined {
  const stored = read();
  const sealed = stored.keys[provider ?? stored.provider];
  if (!sealed) return undefined;
  try {
    return safeStorage.decryptString(Buffer.from(sealed, "base64"));
  } catch {
    return undefined;
  }
}

function encrypt(key: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("This computer can't store the key safely, so it wasn't saved.");
  }
  return safeStorage.encryptString(key).toString("base64");
}

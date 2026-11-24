// What the window and the main process say to each other, through the preload bridge. Types
// only: the preload script and the page both import them, and nothing of this file ships.

/** Where Ask AI's model runs. */
export type Provider = "none" | "ollama" | "lmstudio" | "server" | "openai" | "anthropic";

/** The settings as the window sees them: a key is never sent back, only whether there is one. */
export interface PublicSettings {
  provider: Provider;
  /** The API root, `/v1` included, for every provider but Anthropic. */
  baseUrl?: string;
  model?: string;
  /** Attach a small copy of the photo to each request, for models that read images. */
  sendImage: boolean;
  /** Whether a key is stored for this provider. */
  hasKey: boolean;
  /** Every provider with a stored key, so Settings can say so before switching. */
  keys: Provider[];
}

export interface SettingsInput {
  provider: Provider;
  baseUrl?: string;
  model?: string;
  sendImage: boolean;
  /** A new key for this provider; `null` forgets the stored one, leaving it out keeps it. */
  key?: string | null;
}

export interface ModelQuery {
  provider: Provider;
  baseUrl?: string;
  /** A key typed in but not saved yet; otherwise the stored one is used. */
  key?: string;
}

export interface ModelList {
  models: string[];
  error?: string;
}

/** A request to the model, made by the main process so the server needs no CORS. */
export interface ModelRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ModelResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

/** A file to save, or one opened from the File menu. */
export interface FileData {
  name: string;
  type: string;
  data: ArrayBuffer;
}

export interface SaveResult {
  saved: number;
  /** The file, or the folder for several. */
  where: string;
}

export interface RetouchApp {
  loadSettings(): Promise<PublicSettings>;
  saveSettings(input: SettingsInput): Promise<PublicSettings>;
  listModels(query: ModelQuery): Promise<ModelList>;
  fetch(request: ModelRequest): Promise<ModelResponse>;
  saveFiles(files: FileData[]): Promise<SaveResult | null>;
  onOpenSettings(listener: () => void): void;
  onOpenFiles(listener: (files: FileData[]) => void): void;
}

/** The link in Ask AI's notice that opens Settings: the main process catches it. */
export const SETTINGS_URL = "app://retouch/settings";

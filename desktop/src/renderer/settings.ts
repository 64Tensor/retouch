// Settings: the model Ask AI uses. A dialog over the editor. Picking a provider shows only what
// it needs (an address, a key, a model), says where requests go, and for a model on this Mac
// finds the models it has. Keys go to the main process, which seals them in the Keychain.

import type { Provider, PublicSettings, RetouchApp, SettingsInput } from "../shared/api";
import { plain } from "./bridge";

interface Choice {
  id: Provider;
  name: string;
  /** The line under the name. */
  where: string;
  /** Where Ask AI's requests go, finishing "Your words…". */
  goes: string;
  /** The address it starts from: shown as the placeholder, used when left empty. */
  address?: string;
  key?: "required" | "optional";
  /** A model on this Mac: its models are listed when it's picked. */
  local?: boolean;
}

const CHOICES: Choice[] = [
  { id: "none", name: "No model", where: "Ask AI stays off", goes: "" },
  {
    id: "ollama",
    name: "Ollama",
    where: "Free, on this Mac",
    goes: "stay on this Mac",
    address: "http://localhost:11434/v1",
    local: true,
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    where: "Free, on this Mac",
    goes: "stay on this Mac",
    address: "http://localhost:1234/v1",
    local: true,
  },
  {
    id: "server",
    name: "Another server",
    where: "Any OpenAI-compatible address",
    goes: "go to the address above, and nowhere else",
    key: "optional",
  },
  {
    id: "openai",
    name: "OpenAI",
    where: "Your own API key",
    goes: "go to OpenAI",
    key: "required",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    where: "Your own API key",
    goes: "go to Anthropic",
    key: "required",
  },
];

const KEY_PLACEHOLDER: Partial<Record<Provider, string>> = {
  openai: "sk-…",
  anthropic: "sk-ant-…",
  server: "Only if the server asks for one",
};

function choiceOf(provider: Provider): Choice {
  return CHOICES.find((c) => c.id === provider) ?? (CHOICES[0] as Choice);
}

/** Whether Ask AI has a model to talk to. */
export function connected(settings: PublicSettings): boolean {
  if (settings.provider === "none") return false;
  if (choiceOf(settings.provider).key === "required") return settings.hasKey;
  return Boolean(settings.baseUrl);
}

/** The model in a few words, for the bar. */
export function modelName(settings: PublicSettings): string {
  if (!connected(settings)) return "No model";
  let name = choiceOf(settings.provider).name;
  if (settings.provider === "server" && settings.baseUrl) {
    try {
      name = new URL(settings.baseUrl).host;
    } catch {}
  }
  return settings.model ? `${name} · ${settings.model}` : name;
}

const TEMPLATE = `
  <form method="dialog" class="settings__form" novalidate>
    <h2 class="settings__title" id="settings-title">Ask AI’s model</h2>
    <p class="settings__lead">Ask AI turns a sentence into edits. It needs a language model: one running on this Mac, or your own provider.</p>
    <fieldset class="settings__choices">
      <legend class="settings__hidden">Model</legend>
      ${CHOICES.map(
        (c) => `
        <label class="choice">
          <input type="radio" name="provider" value="${c.id}" />
          <span class="choice__name">${c.name}</span>
          <span class="choice__where">${c.where}</span>
        </label>`,
      ).join("")}
    </fieldset>
    <div class="settings__fields">
      <div class="field" data-field="address">
        <label class="field__label" for="settings-address">Address</label>
        <input class="field__input" id="settings-address" name="baseUrl" type="url" autocomplete="off" spellcheck="false" />
      </div>
      <div class="field" data-field="key">
        <label class="field__label" for="settings-key">API key</label>
        <div class="field__row">
          <input class="field__input" id="settings-key" name="key" type="password" autocomplete="off" spellcheck="false" />
          <button class="button button--quiet" type="button" data-action="forget">Forget</button>
        </div>
        <p class="field__hint" data-hint="key"></p>
      </div>
      <div class="field" data-field="model">
        <label class="field__label" for="settings-model">Model</label>
        <div class="field__row">
          <input class="field__input" id="settings-model" name="model" list="settings-models" autocomplete="off" spellcheck="false" />
          <button class="button" type="button" data-action="find">Find models</button>
        </div>
        <datalist id="settings-models"></datalist>
        <p class="field__hint" data-hint="model" aria-live="polite"></p>
      </div>
      <label class="check" data-field="image">
        <input type="checkbox" name="sendImage" />
        <span>Send a small copy of the photo with each request, so the model can see it. Turn this off for a model that reads text only.</span>
      </label>
    </div>
    <p class="settings__privacy" data-privacy></p>
    <p class="settings__error" role="alert" hidden></p>
    <div class="settings__actions">
      <button class="button" type="button" data-action="cancel">Cancel</button>
      <button class="button button--primary" type="submit">Save</button>
    </div>
  </form>`;

export interface SettingsDialog {
  open(current: PublicSettings): void;
}

export function createSettings(
  bridge: RetouchApp,
  onSaved: (settings: PublicSettings) => void,
): SettingsDialog {
  const dialog = document.createElement("dialog");
  dialog.className = "settings";
  dialog.setAttribute("aria-labelledby", "settings-title");
  dialog.innerHTML = TEMPLATE;
  document.body.appendChild(dialog);

  const $ = <T extends Element>(selector: string) => dialog.querySelector(selector) as T;
  const form = $<HTMLFormElement>("form");
  const address = $<HTMLInputElement>("#settings-address");
  const key = $<HTMLInputElement>("#settings-key");
  const model = $<HTMLInputElement>("#settings-model");
  const models = $<HTMLDataListElement>("#settings-models");
  const sendImage = $<HTMLInputElement>('input[name="sendImage"]');
  const forgetButton = $<HTMLButtonElement>('[data-action="forget"]');
  const findButton = $<HTMLButtonElement>('[data-action="find"]');
  const keyHint = $<HTMLElement>('[data-hint="key"]');
  const modelHint = $<HTMLElement>('[data-hint="model"]');
  const privacy = $<HTMLElement>("[data-privacy]");
  const error = $<HTMLElement>(".settings__error");
  const submit = $<HTMLButtonElement>('button[type="submit"]');

  let current: PublicSettings | undefined;
  /** Forget the stored key on save, unless a new one is typed. */
  let forget = false;
  /** Which "Find models" answer is the latest; older ones are dropped. */
  let asked = 0;

  const provider = (): Provider =>
    ((form.elements.namedItem("provider") as RadioNodeList).value as Provider) || "none";

  function stored(id: Provider): boolean {
    return Boolean(current?.keys.includes(id)) && !forget;
  }

  function show(field: string, visible: boolean): void {
    $<HTMLElement>(`[data-field="${field}"]`).hidden = !visible;
  }

  function update(): void {
    const id = provider();
    const choice = choiceOf(id);
    show("address", Boolean(choice.local || id === "server"));
    show("key", Boolean(choice.key));
    show("model", id !== "none");
    show("image", id !== "none");
    address.placeholder = choice.address ?? "https://example.com/v1";

    const has = stored(id);
    forgetButton.hidden = !has;
    key.placeholder = has ? "Stored in your Mac’s Keychain" : (KEY_PLACEHOLDER[id] ?? "");
    keyHint.textContent = has
      ? "Type a new key to replace it."
      : "Kept in your Mac’s Keychain and sent only with Ask AI’s requests.";
    findButton.hidden = id === "none";
    model.placeholder = id === "anthropic" ? "claude-haiku-5-5, the default" : "";

    if (id === "none") {
      privacy.textContent = "Nothing is sent anywhere. Everything but Ask AI works the same.";
    } else {
      const what = sendImage.checked ? "Your words and a small copy of the photo" : "Your words";
      privacy.textContent = `${what} ${choice.goes}.`;
    }
  }

  function fail(text: string): void {
    error.textContent = text;
    error.hidden = !text;
  }

  async function find(): Promise<void> {
    const id = provider();
    if (id === "none") return;
    const ask = ++asked;
    findButton.disabled = true;
    modelHint.textContent = "Looking…";
    const list = await bridge
      .listModels({
        provider: id,
        baseUrl: address.value.trim() || undefined,
        key: key.value.trim() || undefined,
      })
      .catch((e: unknown) => ({ models: [] as string[], error: plain(e) }));
    if (ask !== asked) return;
    findButton.disabled = false;
    models.replaceChildren(
      ...list.models.map((name) =>
        Object.assign(document.createElement("option"), { value: name }),
      ),
    );
    if (list.error) {
      modelHint.textContent = list.error;
    } else if (list.models.length === 0) {
      modelHint.textContent = choiceOf(id).local
        ? `${choiceOf(id).name} has no models yet. Download one in ${choiceOf(id).name} first.`
        : "No models found. Type the model’s name.";
    } else {
      const count = list.models.length;
      modelHint.textContent = `${count} model${count === 1 ? "" : "s"} found. Click the field to choose.`;
      if (!model.value.trim()) model.value = list.models[0] as string;
    }
  }

  function pick(id: Provider): void {
    // A model, an address and a key belong to one provider: start from that provider's own.
    const same = id === current?.provider;
    model.value = same ? (current?.model ?? "") : "";
    address.value =
      same && current?.baseUrl !== choiceOf(id).address ? (current?.baseUrl ?? "") : "";
    key.value = "";
    forget = false;
    models.replaceChildren();
    modelHint.textContent = "";
    fail("");
    update();
    // A model on this Mac lists its models right away. Anywhere else is asked only on "Find models".
    if (choiceOf(id).local) void find();
  }

  function input(): SettingsInput | string {
    const id = provider();
    const choice = choiceOf(id);
    if (id === "server" && !address.value.trim()) return "Enter the server’s address.";
    const typed = key.value.trim();
    if (choice.key === "required" && !typed && !stored(id)) return "Enter your API key.";
    if (id !== "none" && id !== "anthropic" && !model.value.trim()) {
      return "Choose a model, or type its name.";
    }
    return {
      provider: id,
      baseUrl: address.value.trim() || undefined,
      model: model.value.trim() || undefined,
      sendImage: sendImage.checked,
      key: typed || (forget ? null : undefined),
    };
  }

  form.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === "provider") pick(target.value as Provider);
    else update();
  });
  forgetButton.addEventListener("click", () => {
    forget = true;
    update();
    key.focus();
  });
  findButton.addEventListener("click", () => void find());
  $<HTMLButtonElement>('[data-action="cancel"]').addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = input();
    if (typeof next === "string") return fail(next);
    fail("");
    submit.disabled = true;
    try {
      const saved = await bridge.saveSettings(next);
      current = saved;
      dialog.close();
      onSaved(saved);
    } catch (e) {
      fail(plain(e));
    } finally {
      submit.disabled = false;
    }
  });

  return {
    open(settings) {
      if (dialog.open) return;
      current = settings;
      for (const radio of dialog.querySelectorAll<HTMLInputElement>('input[name="provider"]')) {
        radio.checked = radio.value === settings.provider;
      }
      sendImage.checked = settings.sendImage;
      pick(settings.provider);
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[name="provider"]:checked')?.focus();
    },
  };
}

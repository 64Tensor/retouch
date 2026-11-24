import type { AiContext } from "../src/ai/interpreter";
import { hasModel, interpretCommand, noticeFor } from "../src/ai/interpreter";
import { DEFAULT_EDITS } from "../src/constants";
import type { ViewHandle } from "../src/types";
import { createAiChat } from "../src/ui/editor/ai-chat";
import { createEditor } from "../src/ui/editor/editor";
import { makeImageEntry, stubLayout } from "./editor-helpers";

const CTX: AiContext = {
  kind: "image",
  width: 800,
  height: 600,
  edits: structuredClone(DEFAULT_EDITS),
};

describe("connecting a model", () => {
  it("counts a key, a transport, or an OpenAI-compatible server as a model", () => {
    expect(hasModel({})).toBe(false);
    expect(hasModel({ apiKey: "sk-ant-x" })).toBe(true);
    expect(hasModel({ complete: async () => ({}) })).toBe(true);
    // A local server needs no key, only where it is…
    expect(hasModel({ provider: "openai", baseUrl: "http://localhost:11434/v1" })).toBe(true);
    // …but OpenAI's own API does.
    expect(hasModel({ provider: "openai" })).toBe(false);
    // An Anthropic proxy without a key still needs one, as before.
    expect(hasModel({ baseUrl: "https://proxy.example" })).toBe(false);
  });

  it("uses the notice only while nothing connects a model", () => {
    expect(noticeFor({})).toBeUndefined();
    expect(noticeFor({ notice: "Connect a model" })).toEqual({ text: "Connect a model" });
    const notice = { text: "Connect a model", links: [{ label: "How", href: "/how" }] };
    expect(noticeFor({ notice })).toBe(notice);
    expect(noticeFor({ notice, apiKey: "sk-ant-x" })).toBeUndefined();
    expect(noticeFor({ notice, allowUserKey: true })).toBeUndefined();
  });
});

describe("the OpenAI-compatible transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stub fetch with one response; returns the mock, to read what was sent. */
  function respond(body: unknown, status = 200) {
    const fetch = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  const toolCall = (args: unknown) => ({
    choices: [
      {
        message: {
          tool_calls: [
            {
              type: "function",
              function: { name: "apply_edits", arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  });

  const sent = (fetch: ReturnType<typeof respond>) => {
    const [url, init] = fetch.mock.calls[0] ?? [];
    return {
      url,
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    };
  };

  it("calls chat/completions with a forced function call and validates the result", async () => {
    const fetch = respond(toolCall({ explanation: "Warmer", adjustments: { temperature: 500 } }));
    const ops = await interpretCommand(
      { provider: "openai", baseUrl: "http://localhost:11434/v1/", model: "llava" },
      "warmer",
      CTX,
    );
    const { url, headers, body } = sent(fetch);
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    // No key, no Authorization header: a local server doesn't want one.
    expect(headers.authorization).toBeUndefined();
    expect(body.model).toBe("llava");
    expect(body.messages[0]).toEqual({ role: "system", content: expect.any(String) });
    // Text alone goes as a plain string.
    expect(body.messages[1]).toEqual({ role: "user", content: "warmer" });
    expect(body.tools[0].function.name).toBe("apply_edits");
    expect(body.tools[0].function.parameters).toEqual(expect.objectContaining({ type: "object" }));
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "apply_edits" } });
    expect(ops.explanation).toBe("Warmer");
    expect(ops.adjustments?.temperature).toBe(100);
  });

  it("sends the key as a bearer token and the frame as an image part", async () => {
    const fetch = respond(toolCall({ explanation: "Cropped" }));
    await interpretCommand(
      { provider: "openai", apiKey: "sk-test", model: "gpt-test" },
      "crop to the dog",
      CTX,
      "AAAA",
    );
    const { url, headers, body } = sent(fetch);
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(headers.authorization).toBe("Bearer sk-test");
    expect(body.messages[1].content).toEqual([
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
      { type: "text", text: "crop to the dog" },
    ]);
  });

  it("accepts a model that answers in plain JSON, fenced or not", async () => {
    respond({
      choices: [{ message: { content: '```json\n{"explanation":"Mono","filter":"mono"}\n```' } }],
    });
    const ai = { provider: "openai" as const, baseUrl: "http://localhost:1234/v1", model: "m" };
    const ops = await interpretCommand(ai, "black and white", CTX);
    expect(ops.explanation).toBe("Mono");

    respond({ choices: [{ message: { content: "Sorry, I can't do that." } }] });
    await expect(interpretCommand(ai, "x", CTX)).rejects.toThrow("AI returned no edit operations");
  });

  it("reports the server's error message, in either shape", async () => {
    const ai = { provider: "openai" as const, baseUrl: "http://localhost:11434/v1", model: "m" };
    respond({ error: { message: "model not found" } }, 404);
    await expect(interpretCommand(ai, "x", CTX)).rejects.toThrow("model not found");
    respond({ error: "llava does not support tools" }, 400);
    await expect(interpretCommand(ai, "x", CTX)).rejects.toThrow("does not support tools");
  });

  it("asks for a model name rather than guessing one", async () => {
    const fetch = respond(toolCall({ explanation: "x" }));
    await expect(
      interpretCommand({ provider: "openai", baseUrl: "http://localhost:11434/v1" }, "x", CTX),
    ).rejects.toThrow("Set ai.model");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Ask AI's notice", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the text and links instead of the input, and takes no commands", () => {
    const onSubmit = vi.fn();
    const chat = createAiChat({
      ai: {},
      onSubmit,
      suggestions: ["Warmer light"],
      notice: {
        text: "Ask AI needs a language model.",
        links: [
          { label: "Connect one", href: "https://example.com/ai" },
          { label: "Sign in", note: "coming soon" },
        ],
      },
    });
    document.body.appendChild(chat.root);
    chat.open();

    expect(chat.root.querySelector(".rt-ai__notice-text")?.textContent).toBe(
      "Ask AI needs a language model.",
    );
    const link = chat.root.querySelector<HTMLAnchorElement>(".rt-ai__notice a");
    expect(link?.href).toBe("https://example.com/ai");
    // A new tab, so the photo being edited stays open.
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toBe("noopener");
    expect(document.activeElement).toBe(link);
    // A way forward without an address is plain text, with its note.
    expect(chat.root.querySelector(".rt-ai__notice-label")?.textContent).toBe("Sign in");
    expect(chat.root.querySelector(".rt-ai__notice-note")?.textContent).toBe("coming soon");

    expect(chat.root.querySelector(".rt-ai__input")).toBeNull();
    expect(chat.root.querySelector(".rt-ai__suggestions")).toBeNull();
    expect(chat.root.querySelector(".rt-ai__panel--notice")).not.toBeNull();
    expect(chat.root.querySelector(".rt-ai__empty")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    chat.destroy();
  });

  it("focuses the close button when there's no link", () => {
    const chat = createAiChat({ ai: {}, onSubmit: vi.fn(), notice: { text: "No model" } });
    document.body.appendChild(chat.root);
    chat.open();
    expect(document.activeElement).toBe(chat.root.querySelector(".rt-ai__close"));
    chat.destroy();
  });
});

describe("the editor's Ask AI", () => {
  let restoreLayout: () => void;
  let editor: ViewHandle | null = null;

  beforeEach(() => {
    restoreLayout = stubLayout(800, 600);
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
    document.body.innerHTML = "";
    restoreLayout();
  });

  function open(ai?: Parameters<typeof createEditor>[0]["ai"]): void {
    editor = createEditor({ entry: makeImageEntry(), onDone: vi.fn(), onCancel: vi.fn(), ai });
    document.body.appendChild(editor.root);
  }

  it("stays hidden without a model or a notice", () => {
    open({});
    expect(document.querySelector(".rt-ai")).toBeNull();
  });

  it("shows the notice when there's no model", () => {
    open({ notice: "Connect a model to use Ask AI." });
    expect(document.querySelector(".rt-ai__notice-text")?.textContent).toBe(
      "Connect a model to use Ask AI.",
    );
    expect(document.querySelector(".rt-ai__input")).toBeNull();
  });

  it("takes commands once a local server is connected, notice or not", () => {
    open({
      provider: "openai",
      baseUrl: "http://localhost:11434/v1",
      model: "llava",
      notice: "Connect a model to use Ask AI.",
    });
    expect(document.querySelector(".rt-ai__notice")).toBeNull();
    expect(document.querySelector(".rt-ai__input")).not.toBeNull();
  });
});

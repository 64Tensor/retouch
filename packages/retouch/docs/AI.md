# Connecting a model

Rétouch ships without a language model. Everything in the editor works without one, and so do
the on-device ML tools in `@64tensor/retouch-ml`. **Ask AI**, which turns "moody and cinematic,
crop to a square" into edits, needs a model, and you choose which one and where it runs:

| Where the model runs | What leaves the user's device | Set |
|---|---|---|
| On the user's own computer: Ollama, LM Studio, llama.cpp | nothing | `provider: "openai"`, `baseUrl`, `model` |
| Behind your server | the request, to your server, then to the model you call | `baseUrl` (your proxy) or `complete` |
| At a provider, called from the browser | the request, to that provider | `apiKey`, or `allowUserKey` |
| Nowhere yet | nothing | `notice`, to say how to get one |

**What a request holds:** the system prompt, with the photo's current settings; the user's words;
and, unless `sendImage` is `false`, a JPEG of the current frame at most 512 pixels on its longest
side, so commands like "crop to the dog" can see the photo. Every value the model sends back is
validated and clamped by the same code the manual tools use before it touches the edit.

## A model on your computer

Ollama, LM Studio and llama.cpp each serve an OpenAI-compatible API, and Rétouch speaks it with
`provider: "openai"`. No key is needed, and nothing leaves the computer.

```ts
new Retouch({
  target: "#editor",
  ai: {
    provider: "openai",
    baseUrl: "http://localhost:11434/v1", // Ollama
    model: "mistral-small3.1",            // any model you've pulled
  },
});
```

| Server | `baseUrl` | Before it works |
|---|---|---|
| [Ollama](https://ollama.com) | `http://localhost:11434/v1` | `ollama pull` the model. Pages served from `localhost` are allowed by default; for any other origin, start Ollama with `OLLAMA_ORIGINS` set to it |
| [LM Studio](https://lmstudio.ai) | `http://localhost:1234/v1` | start its server and turn on CORS in the server settings |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | `http://localhost:8080/v1` | run `llama-server` with `--jinja`, which tool calls need |

**Choose a model that can call tools** (function calling): Rétouch asks for the edits as one tool
call. For commands that look at the photo, it also has to read images. Ollama's library marks
both ("tools", "vision"). A model that answers with plain JSON instead of a tool call is accepted
too.

**A text-only model** can still take the commands that don't need to see the photo, such as
"warmer" or "black and white". Set `sendImage: false` so it isn't sent a picture it can't read.

**From a public site,** a browser may ask the user before the page can reach a server on their
computer, and the server has to allow the site's origin (`OLLAMA_ORIGINS`, LM Studio's CORS
switch). Serving the app from `localhost` avoids both.

## Behind your server

In production, keep keys off the page: point `baseUrl` at a server of yours that adds the key
and forwards the request in the same wire format, Anthropic's by default or OpenAI's with
`provider: "openai"`.

```ts
ai: { baseUrl: "https://your-app.example/ai" }                             // Anthropic's format
ai: { provider: "openai", baseUrl: "https://your-app.example/ai/v1", model: "…" } // OpenAI's
```

Or take over the call entirely with `complete`, which gets the request and must resolve to the
edit operations:

```ts
ai: {
  complete: async ({ system, prompt, imageBase64, schema }) => {
    const response = await fetch("/ai", {
      method: "POST",
      body: JSON.stringify({ system, prompt, imageBase64, schema }),
    });
    return response.json(); // { explanation: "…", adjustments: { … }, … }
  },
}
```

An app with a way out of its own, such as a desktop app's main process, can keep the built-in
call and change only how it's sent, with `fetch`. It gets the same arguments as the browser's
`fetch` and must resolve to a `Response`:

```ts
ai: {
  provider: "openai",
  baseUrl: "http://localhost:11434/v1",
  model: "mistral-small3.1",
  fetch: (url, init) => myApp.send(url, init), // sent by the app, so the server needs no CORS
}
```

Rétouch's Mac app works this way: the window hands each request to the main process, which adds
the key from the Keychain and sends it, so the page never holds the key and Ollama or LM Studio
need no CORS setting.

## A provider, from the browser

For prototypes, the browser can call a provider directly. The key is then visible to anyone who
opens the page, so use a key you can revoke.

```ts
ai: { apiKey: "sk-ant-…" }                                      // Anthropic: claude-haiku-5-5
ai: { apiKey: "sk-ant-…", model: "claude-sonnet-5-5" }          // another Anthropic model
ai: { provider: "openai", apiKey: "sk-…", model: "…" }          // OpenAI
ai: { provider: "openai", baseUrl: "https://…/v1", apiKey: "…", model: "…" } // another provider
```

Not every provider accepts calls from a browser (CORS). Those that don't need the server above.

`allowUserKey: true` lets each user paste their own key instead. It's kept in that browser's
`localStorage`, and Ask AI then sends the user's words and the frame from their browser straight
to the provider. The popover says so.

## No model yet

If your app ships without a model, `notice` keeps Ask AI on the editor and makes its panel say
how to get one instead of taking commands. Nothing is sent anywhere.

```ts
ai: {
  notice: {
    text: "Ask AI needs a language model. Connect one in Settings.",
    links: [
      { label: "How to connect a model", href: "https://your-app.example/help/ai" },
      { label: "Use ours", note: "coming soon" }, // no href: shown as text
    ],
  },
}
```

A plain string works too: `notice: "Ask AI needs a language model."`. Links open in a new tab, so
the photo being edited stays open. The notice gives way as soon as a model is connected, and
isn't used with `allowUserKey`, whose popover is the way to connect one.

## Options

| Option | What it does |
|---|---|
| `provider` | `"anthropic"` (default) or `"openai"`, for any OpenAI-compatible Chat Completions API |
| `baseUrl` | where requests go: a proxy, or for `"openai"` the API root with `/v1` (default: OpenAI's) |
| `model` | the model's name. Defaults to `claude-haiku-5-5` for Anthropic; required for `"openai"` |
| `apiKey` | the provider's key, sent from the browser. Not needed for a local server |
| `sendImage` | `false` to send no frame, for text-only models. Default `true` |
| `allowUserKey` | let users paste their own key, kept in their browser |
| `complete` | your own transport, replacing the built-in call |
| `fetch` | the `fetch` the built-in call uses, in place of the browser's: send it through your own code |
| `notice` | what Ask AI says while no model is connected |

Ask AI shows on the editor once a model is connected (`apiKey`, `complete`, or `"openai"` with a
`baseUrl`), with `allowUserKey`, or with a `notice`. Events: `ai:start`, `ai:applied`,
`ai:error`.

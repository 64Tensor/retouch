---
"@64tensor/retouch": minor
---

Ask AI can use any OpenAI-compatible model, and can say how to get one when there's none.

- `ai: { provider: "openai", baseUrl, model }` speaks the OpenAI-compatible Chat Completions API
  that Ollama, LM Studio, llama.cpp and most providers serve. A local server needs no key, so
  Ask AI can run with nothing leaving the computer. `apiKey`, when set, goes as a bearer token.
- `ai: { notice }` keeps Ask AI on the editor without a model: its panel shows your text and
  links instead of taking commands, and sends nothing. It gives way once a model is connected.
- `allowUserKey`'s popover now says that each edit sends the user's words and a small copy of the
  photo straight to the provider.
- The new [Connecting a model](https://github.com/64Tensor/retouch/blob/main/packages/retouch/docs/AI.md)
  guide ships in the package with the other docs.
- The plugins and advanced-features guides link to `@64tensor/retouch-ml`'s files where they
  are in the repository.

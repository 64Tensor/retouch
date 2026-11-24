# Rétouch for the Mac

The editor and its ML tools in a window of their own, for people who'd rather download an app
than install a package. It's built from this repository's packages on every release and ships
as two DMGs, Apple silicon and Intel, on [GitHub Releases](https://github.com/64Tensor/retouch/releases).
It isn't published to npm.

Nothing leaves the Mac unless the person asks for it: Ask AI talks only to the model chosen in
Settings (Ollama or LM Studio on the same Mac, a server of their own, or OpenAI or Anthropic with
their own key), an ML tool downloads its model the first time it runs, and "Check for Updates…"
asks GitHub only when clicked.

## How it fits together

```
src/main/       the main process: the window, the menus, settings, files, Ask AI's requests
src/preload/    the only bridge between the window and the main process
src/renderer/   the window's page: the editor, the ML tools, Settings
src/shared/     the types both sides agree on
```

- The page is served from inside the app as `app://retouch/`, with cross-origin isolation (so
  ONNX Runtime can use threads) and a content security policy that lets it reach nothing but
  where the ML models download from (Hugging Face, and GitHub for face detection's). ONNX
  Runtime's own files ship in the app.
- The window is sandboxed, with no Node. Ask AI's requests go through `ai.fetch` to the main
  process, which sends them only to the model in Settings and adds the key there, so the page
  never holds it and a local server needs no CORS setting.
- Keys are sealed with the system's keychain (`safeStorage`) before they're written to disk.
- Undo and Redo aren't in the Edit menu: the editor handles ⌘Z and ⇧⌘Z itself.

## Working on it

```bash
pnpm --filter desktop start      # build, then open the app
pnpm --filter desktop test       # build first; Playwright drives the built app
pnpm --filter desktop dist       # the two DMGs, in desktop/release/ (macOS only)
```

The tests start the app with empty settings each time and save files without asking
(`RETOUCH_USER_DATA` and `RETOUCH_SAVE_DIR`, which the packaged app ignores). One of them talks
to a mock OpenAI-compatible server that sends no CORS headers.

Until 64Tensor LLC's Developer ID is set up, the DMGs are signed ad hoc and not notarized, so
macOS warns before opening them. CI builds them on every pull request (the `desktop-dmg` job's
artifact) for trying a change.

The icon in `build/` is a placeholder.

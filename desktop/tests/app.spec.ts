// The built app, end to end: a photo goes in, gets cropped, and comes out where the app saves it.
// Ask AI without a model says how to get one and sends nothing. With a model on a server that
// sends no CORS headers, Ask AI's requests go through the main process and the edit applies. A
// key never lands on disk in the clear, and nothing reaches a host other than the model chosen.

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";

const appDir = join(import.meta.dirname, "..");

interface Running {
  app: ElectronApplication;
  page: Page;
  userData: string;
  saved: string;
  errors: string[];
}

/** Start the app with empty settings, saving into a folder of its own without asking. */
async function launch(): Promise<Running> {
  const userData = await mkdtemp(join(tmpdir(), "retouch-data-"));
  const saved = await mkdtemp(join(tmpdir(), "retouch-saved-"));
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, RETOUCH_USER_DATA: userData, RETOUCH_SAVE_DIR: saved },
  });
  // Every request to a network address, from the window or the main process, from here on.
  await app.evaluate(({ session }) => {
    const away: string[] = [];
    Object.assign(globalThis, { away });
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, callback) => {
        away.push(details.url);
        callback({});
      },
    );
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // With nothing open yet, the editor shows its drop zone.
  await expect(page.locator("#editor .rt-dropzone")).toBeVisible();
  return { app, page, userData, saved, errors };
}

async function quit(run: Running): Promise<void> {
  await run.app.close();
  await rm(run.userData, { recursive: true, force: true });
  await rm(run.saved, { recursive: true, force: true });
}

function away(run: Running): Promise<string[]> {
  return run.app.evaluate(() => (globalThis as unknown as { away: string[] }).away.slice());
}

/** Drop a photo of `width` × `height` on the drop zone, as if from the Finder. */
async function dropPhoto(page: Page, name: string, width: number, height: number): Promise<void> {
  const dataTransfer = await page.evaluateHandle(
    async ({ name, width, height }) => {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
      const sky = context.createLinearGradient(0, 0, width, height);
      sky.addColorStop(0, "#2a6f97");
      sky.addColorStop(1, "#f5753f");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], name, { type: "image/jpeg" }));
      return transfer;
    },
    { name, width, height },
  );
  await page.locator("#editor .rt-dropzone").dispatchEvent("drop", { dataTransfer });
}

/** The width and height in a JPEG's frame header. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.readUInt16BE(0), "a JPEG starts with SOI").toBe(0xffd8);
  let at = 2;
  while (at < bytes.length) {
    const marker = bytes.readUInt16BE(at);
    const length = bytes.readUInt16BE(at + 2);
    // SOF0 to SOF15, leaving out DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  throw new Error("No frame header in the JPEG");
}

/** The JPEG the editor's Download saved into `folder`, once it's whole. */
async function savedJpeg(folder: string, name: RegExp): Promise<Buffer> {
  let bytes = Buffer.alloc(0);
  await expect
    .poll(async () => {
      const file = (await readdir(folder)).find((f) => name.test(f));
      if (!file) return false;
      bytes = await readFile(join(folder, file));
      return bytes.length > 4 && bytes.readUInt16BE(bytes.length - 2) === 0xffd9;
    })
    .toBe(true);
  return bytes;
}

test("a photo, cropped square, saves square", async () => {
  const run = await launch();
  try {
    // Served with COOP and COEP, so ONNX Runtime can use threads.
    expect(await run.page.evaluate(() => crossOriginIsolated)).toBe(true);
    await expect(run.page.locator("#model")).toHaveText("No model");

    await dropPhoto(run.page, "field.jpg", 1600, 1000);
    await run.page.getByRole("button", { name: "Edit field.jpg" }).click();
    const editor = run.page.locator(".rt-editor-overlay");
    // Below the bar, clear of the traffic lights.
    expect(await editor.evaluate((e) => e.getBoundingClientRect().top)).toBe(44);
    await editor.getByRole("button", { name: "Crop", exact: true }).click();
    await editor
      .getByRole("group", { name: "Aspect ratio" })
      .getByRole("button", { name: "Square" })
      .click();
    await editor
      .getByRole("button", { name: "Apply", exact: true })
      .filter({ visible: true })
      .click();
    await editor.getByRole("button", { name: "Download as JPG" }).click();

    const bytes = await savedJpeg(run.saved, /^field.*\.jpg$/);
    expect(jpegSize(bytes)).toEqual({ width: 1000, height: 1000 });
    expect(await away(run)).toEqual([]);
    expect(run.errors).toEqual([]);
  } finally {
    await quit(run);
  }
});

test("Ask AI without a model says how to get one, and sends nothing", async () => {
  const run = await launch();
  try {
    await dropPhoto(run.page, "field.jpg", 1200, 800);
    await run.page.getByRole("button", { name: "Edit field.jpg" }).click();
    const editor = run.page.locator(".rt-editor-overlay");
    await editor.getByRole("button", { name: "Ask AI to edit" }).filter({ visible: true }).click();

    await expect(editor.getByText(/^Ask AI needs a language model\./)).toBeVisible();
    await expect(editor.getByRole("textbox", { name: "AI edit command" })).toHaveCount(0);
    await expect(editor.getByRole("link", { name: "How to connect a model" })).toHaveAttribute(
      "href",
      "https://64tensor.com/retouch/docs/ai",
    );

    // The notice's first link opens Settings, in the app rather than a browser.
    await editor.getByRole("link", { name: "Open Settings" }).click();
    const dialog = run.page.getByRole("dialog", { name: "Ask AI’s model" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /^No model/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    expect(await away(run)).toEqual([]);
    expect(run.errors).toEqual([]);
  } finally {
    await quit(run);
  }
});

test("a model on a server with no CORS: Ask AI's request goes through the app and the edit applies", async () => {
  // An OpenAI-compatible server, like Ollama or LM Studio, that sends no CORS headers at all.
  const received: { url?: string; headers: IncomingHttpHeaders; body?: unknown }[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      received.push({ url: request.url, headers: request.headers, body: body && JSON.parse(body) });
      response.setHeader("content-type", "application/json");
      if (request.url === "/v1/models") {
        response.end(JSON.stringify({ object: "list", data: [{ id: "mock-vision" }] }));
      } else if (request.url === "/v1/chat/completions") {
        const message = { role: "assistant", content: JSON.stringify({ aspect: "1:1" }) };
        response.end(JSON.stringify({ choices: [{ message }] }));
      } else {
        response.statusCode = 404;
        response.end("{}");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/v1`;

  const run = await launch();
  try {
    await run.page.locator("#model").click();
    const dialog = run.page.getByRole("dialog", { name: "Ask AI’s model" });
    await dialog.getByText("Another server", { exact: true }).click();
    await dialog.getByLabel("Address", { exact: true }).fill(base);
    await dialog.getByRole("button", { name: "Find models" }).click();
    await expect(dialog.getByText("1 model found.", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel("Model", { exact: true })).toHaveValue("mock-vision");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(run.page.locator("#model")).toHaveText(`127.0.0.1:${port} · mock-vision`);

    await dropPhoto(run.page, "field.jpg", 1600, 1000);
    await run.page.getByRole("button", { name: "Edit field.jpg" }).click();
    const editor = run.page.locator(".rt-editor-overlay");
    await editor.getByRole("button", { name: "Ask AI to edit" }).filter({ visible: true }).click();
    const command = editor.getByRole("textbox", { name: "AI edit command" });
    await command.fill("Make it square");
    await command.press("Enter");

    await expect
      .poll(() => received.filter((r) => r.url === "/v1/chat/completions").length)
      .toBe(1);
    const call = received.find((r) => r.url === "/v1/chat/completions");
    // From the main process: no Origin, so the server needed no CORS. With the photo attached.
    expect(call?.headers.origin).toBeUndefined();
    expect(call?.headers.authorization).toBeUndefined();
    const body = call?.body as { model: string; messages: { content: unknown }[] };
    expect(body.model).toBe("mock-vision");
    expect(JSON.stringify(body.messages.at(-1)?.content)).toContain("data:image/jpeg;base64,");

    // The edit applied: the photo downloads square.
    await editor.getByRole("button", { name: "Close AI chat" }).click();
    await editor.getByRole("button", { name: "Download as JPG" }).click();
    const bytes = await savedJpeg(run.saved, /^field.*\.jpg$/);
    expect(jpegSize(bytes)).toEqual({ width: 1000, height: 1000 });

    expect((await away(run)).every((url) => url.startsWith(`${base}/`))).toBe(true);
    expect(run.errors).toEqual([]);
  } finally {
    await quit(run);
    server.close();
  }
});

test("a key is sealed on disk, and requests go only to the model chosen", async () => {
  const run = await launch();
  try {
    const sealed = await run.app.evaluate(({ safeStorage }) => safeStorage.isEncryptionAvailable());
    test.skip(!sealed, "No system keychain here to seal the key with");

    await run.page.locator("#model").click();
    const dialog = run.page.getByRole("dialog", { name: "Ask AI’s model" });
    await dialog.getByText("OpenAI", { exact: true }).click();
    await dialog.getByLabel("API key", { exact: true }).fill("sk-test-not-a-real-key");
    await dialog.getByLabel("Model", { exact: true }).fill("gpt-test");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(run.page.locator("#model")).toHaveText("OpenAI · gpt-test");

    const raw = await readFile(join(run.userData, "settings.json"), "utf8");
    expect(raw).not.toContain("sk-test-not-a-real-key");
    expect(JSON.parse(raw).keys.openai).toEqual(expect.any(String));

    // Settings says a key is stored, and never shows it.
    await run.page.locator("#model").click();
    await expect(dialog.getByLabel("API key", { exact: true })).toHaveValue("");
    await expect(dialog.getByLabel("API key", { exact: true })).toHaveAttribute(
      "placeholder",
      /Keychain/,
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // The window can't send the key, or anything, anywhere else.
    const answer = await run.page.evaluate(() =>
      window.retouchApp
        .fetch({ url: "https://example.com/v1/chat/completions", method: "POST", headers: {} })
        .then(
          () => "sent",
          (error: unknown) => String(error),
        ),
    );
    expect(answer).toContain("only sends requests to the model chosen in Settings");
    expect(await away(run)).toEqual([]);
  } finally {
    await quit(run);
  }
});

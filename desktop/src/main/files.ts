// Photos in and out: the File menu's Open, and Done saving the results where the user says. The
// editor's own Download goes through Electron's download, which asks where to save as well.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { app, type BrowserWindow, dialog } from "electron";
import type { FileData, SaveResult } from "../shared/api";

const OPENS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
  "heic",
  "heif",
  "mp4",
  "mov",
  "webm",
  "m4v",
];

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** For the tests: save without asking, into this folder. Ignored in the packaged app. */
export const testSaveDir = app.isPackaged ? undefined : process.env.RETOUCH_SAVE_DIR;

export async function chooseFiles(window: BrowserWindow): Promise<FileData[]> {
  const result = await dialog.showOpenDialog(window, {
    title: "Open photos and videos",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Photos and videos", extensions: OPENS }],
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(readData));
}

export async function readData(path: string): Promise<FileData> {
  const bytes = await readFile(path);
  const ext = extname(path).slice(1).toLowerCase();
  return {
    name: basename(path),
    type: TYPES[ext] ?? "application/octet-stream",
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

/** Save the results: one file where the user picks, several into a folder they pick. */
export async function saveFiles(
  window: BrowserWindow,
  files: FileData[],
): Promise<SaveResult | null> {
  if (files.length === 0) return null;
  let folder = testSaveDir;
  if (!folder && files.length === 1) {
    const [only] = files as [FileData];
    const result = await dialog.showSaveDialog(window, {
      defaultPath: join(app.getPath("pictures"), only.name),
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, Buffer.from(only.data));
    return { saved: 1, where: result.filePath };
  }
  if (!folder) {
    const result = await dialog.showOpenDialog(window, {
      title: "Save the photos to…",
      buttonLabel: "Save Here",
      defaultPath: app.getPath("pictures"),
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    folder = result.filePaths[0];
  }
  for (const file of files) {
    await writeFile(freePath(folder, file.name), Buffer.from(file.data));
  }
  return { saved: files.length, where: folder };
}

/** `name` in `folder`, or "name 2", "name 3"… if it's taken. Never overwrites. */
function freePath(folder: string, name: string): string {
  const safe = basename(name).replace(/[/\\:]/g, "-") || "photo";
  const ext = extname(safe);
  const stem = safe.slice(0, safe.length - ext.length);
  let path = join(folder, safe);
  for (let n = 2; existsSync(path); n++) path = join(folder, `${stem} ${n}${ext}`);
  return path;
}

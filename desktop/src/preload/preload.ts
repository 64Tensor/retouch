// The only door between the window and the rest of the Mac. The window runs sandboxed, with no
// Node, so everything it may ask for is listed here, and the main process checks each request.

import { contextBridge, ipcRenderer } from "electron";
import type { FileData, RetouchApp } from "../shared/api";

const api: RetouchApp = {
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (input) => ipcRenderer.invoke("settings:save", input),
  listModels: (query) => ipcRenderer.invoke("models:list", query),
  fetch: (request) => ipcRenderer.invoke("model:fetch", request),
  saveFiles: (files) => ipcRenderer.invoke("files:save", files),
  onOpenSettings: (listener) => {
    ipcRenderer.on("menu:settings", () => listener());
  },
  onOpenFiles: (listener) => {
    ipcRenderer.on("menu:open-files", (_event, files: FileData[]) => listener(files));
  },
};

contextBridge.exposeInMainWorld("retouchApp", api);

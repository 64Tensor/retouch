// Rétouch for the Mac. One window holds the editor, served from inside the app; the main process
// keeps the settings, makes Ask AI's requests and reads and writes files. Nothing is sent anywhere
// unless the user picks a model, runs an ML tool for the first time, or checks for updates.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  nativeTheme,
  session,
  shell,
} from "electron";
import { type FileData, SETTINGS_URL, type SettingsInput } from "../shared/api";
import { chooseFiles, saveFiles, testSaveDir } from "./files";
import { buildMenu } from "./menu";
import { listModels, modelFetch } from "./model";
import { APP_ORIGIN, registerScheme, serveApp } from "./serve";
import { loadSettings, saveSettings } from "./settings";
import { checkForUpdates } from "./updates";

const here = fileURLToPath(new URL(".", import.meta.url));

app.setName("Rétouch");
// The tests start each run with empty settings; the packaged app always uses its own folder.
if (!app.isPackaged && process.env.RETOUCH_USER_DATA) {
  app.setPath("userData", process.env.RETOUCH_USER_DATA);
}
registerScheme();

let window: BrowserWindow | undefined;

function createWindow(): void {
  window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Rétouch",
    backgroundColor: "#0b0b0c",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    webPreferences: {
      preload: join(here, "../preload/preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  window.once("ready-to-show", () => window?.show());
  window.on("closed", () => {
    window = undefined;
  });
  void window.loadURL(`${APP_ORIGIN}/index.html`);
}

/** Only the app's own page may call in. */
function fromApp(event: IpcMainInvokeEvent): BrowserWindow {
  const frame = event.senderFrame;
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!frame?.url.startsWith(`${APP_ORIGIN}/`) || !owner) {
    throw new Error("Not allowed");
  }
  return owner;
}

function registerIpc(): void {
  ipcMain.handle("settings:load", (event) => {
    fromApp(event);
    return loadSettings();
  });
  ipcMain.handle("settings:save", (event, input: SettingsInput) => {
    fromApp(event);
    return saveSettings(input);
  });
  ipcMain.handle("models:list", (event, query) => {
    fromApp(event);
    return listModels(query);
  });
  ipcMain.handle("model:fetch", (event, request) => {
    fromApp(event);
    return modelFetch(request);
  });
  ipcMain.handle("files:save", (event, files: FileData[]) => saveFiles(fromApp(event), files));
}

/** No other web content, no new windows, no permissions beyond what the editor needs. */
function lockDown(): void {
  const allowed = new Set(["clipboard-sanitized-write", "fullscreen"]);
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(allowed.has(permission)),
  );
  session.defaultSession.setPermissionCheckHandler((_contents, permission) =>
    allowed.has(permission),
  );
  // The editor's Download: Electron asks where to save. The tests save without asking.
  session.defaultSession.on("will-download", (_event, item) => {
    if (testSaveDir) item.setSavePath(join(testSaveDir, item.getFilename()));
  });
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, url) => {
      if (!url.startsWith(`${APP_ORIGIN}/`)) event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (url === SETTINGS_URL) contents.send("menu:settings");
      else if (url.startsWith("https://")) void shell.openExternal(url);
      return { action: "deny" };
    });
  });
}

async function openFiles(): Promise<void> {
  if (!window) createWindow();
  const target = window;
  if (!target) return;
  const files = await chooseFiles(target);
  if (files.length > 0) target.webContents.send("menu:open-files", files);
}

void app.whenReady().then(() => {
  nativeTheme.themeSource = "dark";
  serveApp(join(here, "../renderer"));
  lockDown();
  registerIpc();
  Menu.setApplicationMenu(
    buildMenu({
      openFiles: () => void openFiles(),
      openSettings: () => window?.webContents.send("menu:settings"),
      checkForUpdates: () => void checkForUpdates(window, app.getVersion()),
    }),
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// The menu bar. Undo and Redo are left out of Edit on purpose: the editor handles ⌘Z and ⇧⌘Z
// itself, and a menu item would take the keys first. Text fields keep cut, copy and paste.

import { app, Menu, type MenuItemConstructorOptions, shell } from "electron";

export interface MenuActions {
  openFiles(): void;
  openSettings(): void;
  checkForUpdates(): void;
}

const DOCS = "https://64tensor.com/retouch/docs/ai";
const REPO = "https://github.com/64Tensor/retouch";

export function buildMenu(actions: MenuActions): Menu {
  const name = "Rétouch";
  const template: MenuItemConstructorOptions[] = [
    {
      label: name,
      submenu: [
        { role: "about", label: `About ${name}` },
        { label: "Check for Updates…", click: () => actions.checkForUpdates() },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "CommandOrControl+,",
          click: () => actions.openSettings(),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide", label: `Hide ${name}` },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: `Quit ${name}` },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "Open…", accelerator: "CommandOrControl+O", click: () => actions.openFiles() },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [{ role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
    },
    {
      label: "View",
      submenu: app.isPackaged
        ? [{ role: "togglefullscreen" }]
        : [{ role: "togglefullscreen" }, { role: "reload" }, { role: "toggleDevTools" }],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Connecting a Model", click: () => shell.openExternal(DOCS) },
        { label: "Rétouch on GitHub", click: () => shell.openExternal(REPO) },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

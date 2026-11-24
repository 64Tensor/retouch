// "Check for Updates…": asks GitHub, and only when the user clicks it. Rétouch never checks by
// itself, so it sends nothing anywhere unless asked.

import { type BrowserWindow, dialog, net, shell } from "electron";

const RELEASES = "https://api.github.com/repos/64Tensor/retouch/releases?per_page=30";
const TAG = /^@64tensor\/retouch@(\d+)\.(\d+)\.(\d+)$/;

interface Release {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string }[];
}

export async function checkForUpdates(
  window: BrowserWindow | undefined,
  current: string,
): Promise<void> {
  let latest: Release | undefined;
  try {
    const response = await net.fetch(RELEASES, {
      headers: { accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    const releases = (await response.json()) as Release[];
    // The newest release of the editor that carries the Mac app.
    latest = releases
      .filter((r) => !r.draft && !r.prerelease && TAG.test(r.tag_name))
      .filter((r) => r.assets.some((a) => a.name.endsWith(".dmg")))
      .sort((a, b) => compare(versionOf(b.tag_name), versionOf(a.tag_name)))[0];
  } catch (error) {
    await show(window, {
      type: "warning",
      message: "Couldn't check for updates",
      detail: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  if (!latest || compare(versionOf(latest.tag_name), parse(current)) <= 0) {
    await show(window, {
      type: "info",
      message: "Rétouch is up to date",
      detail: `Version ${current}`,
    });
    return;
  }
  const version = versionOf(latest.tag_name).join(".");
  const { response } = await show(window, {
    type: "info",
    message: `Rétouch ${version} is available`,
    detail: `You have ${current}. Download the new version and drag it into Applications.`,
    buttons: ["Download", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) await shell.openExternal(latest.html_url);
}

function show(window: BrowserWindow | undefined, options: Electron.MessageBoxOptions) {
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}

function versionOf(tag: string): number[] {
  return (TAG.exec(tag) ?? []).slice(1).map(Number);
}

function parse(version: string): number[] {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

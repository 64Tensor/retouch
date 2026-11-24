import type { RetouchApp } from "../shared/api";

declare global {
  interface Window {
    /** The preload bridge: the window's only way to the settings, the model and the disk. */
    retouchApp: RetouchApp;
  }
}

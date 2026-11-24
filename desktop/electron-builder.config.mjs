// The Mac app, packed into a DMG for Apple silicon and one for Intel. The app's version is the
// library's: each @64tensor/retouch release gets its own pair. W3a builds them unsigned (ad hoc,
// so the arm64 build runs at all); W3b signs them with 64Tensor LLC's Developer ID in CI and has
// Apple notarize them.

import { readFileSync } from "node:fs";

const library = JSON.parse(
  readFileSync(new URL("../packages/retouch/package.json", import.meta.url), "utf8"),
);
const signed = Boolean(process.env.CSC_LINK);

/** @type {import("electron-builder").Configuration} */
export default {
  appId: "com.64tensor.retouch",
  // Decomposed (e + combining accent), as macOS writes file names: Electron finds its helper apps
  // by the bundle's name, and with the composed é in Info.plist it didn't, and quit at launch.
  productName: "Rétouch".normalize("NFD"),
  copyright: "© 64Tensor LLC",
  extraMetadata: { version: library.version },
  directories: { output: "release", buildResources: "build" },
  // Everything the app runs is bundled into dist; nothing from node_modules ships.
  files: ["dist/**", "package.json"],
  asar: true,
  npmRebuild: false,
  electronLanguages: ["en"],
  mac: {
    target: [{ target: "dmg", arch: ["arm64", "x64"] }],
    category: "public.app-category.photography",
    icon: "build/icon.png",
    // Unsigned builds are signed ad hoc, which Apple silicon needs to run them at all. The hardened
    // runtime is for notarization, and an ad hoc signature can't satisfy its library checks.
    identity: signed ? undefined : "-",
    hardenedRuntime: signed,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    notarize: false,
  },
  dmg: {
    // The app checks for updates only when asked, on GitHub, so no update metadata is needed.
    writeUpdateInfo: false,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills these in.
    artifactName: "Retouch-${version}-${arch}.${ext}",
    // The mounted volume's name, the same for both.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills these in.
    title: "${productName} ${version}",
  },
  publish: null,
};

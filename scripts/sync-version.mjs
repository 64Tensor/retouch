// After `changeset version` bumps the packages, write the new version into the core's VERSION
// constant, so `Retouch.VERSION` can't drift from package.json. tests/version.test.ts checks it.

import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../packages/retouch/", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const file = new URL("src/constants.ts", root);
const source = readFileSync(file, "utf8");
const next = source.replace(
  /export const VERSION = "[^"]*";/,
  `export const VERSION = "${version}";`,
);

if (next === source && !source.includes(`export const VERSION = "${version}";`)) {
  throw new Error('No `export const VERSION = "…";` line found in src/constants.ts');
}
writeFileSync(file, next);
console.log(`VERSION is ${version}`);

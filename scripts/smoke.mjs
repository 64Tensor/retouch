// What a user of the published packages would get, checked before anything is published.
//
// Inside the repository the packages point at their source (see each package.json's `exports`),
// so tests and the playground never touch `dist/`. This script does, after `pnpm build`:
//   1. imports each built entry point from plain Node;
//   2. packs each package with `pnpm pack`, which applies `publishConfig` and rewrites
//      `workspace:` ranges exactly as publishing does, and inspects the tarball;
//   3. runs publint and Are the Types Wrong on that same tarball.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const bin = (name) => join(root, "node_modules/.bin", name);
let failures = 0;

function check(ok, message) {
  console.log(`  ${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures++;
}

function run(command, args, cwd = root) {
  try {
    return { ok: true, out: execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" }) };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

const packages = [
  {
    dir: "packages/retouch",
    exports: ["Retouch", "renderLook", "refreshRangeFill", "VERSION"],
    files: ["dist/index.js", "dist/index.d.ts", "docs/PLUGINS.md", "CHANGELOG.md"],
  },
  {
    dir: "packages/ml",
    exports: ["installMlTools", "removeBackground"],
    files: [
      "dist/index.js",
      "dist/index.d.ts",
      "CHANGELOG.md",
      "THIRD_PARTY_NOTICES.md",
      "third-party-models.json",
    ],
  },
];

const core = JSON.parse(readFileSync(join(root, "packages/retouch/package.json"), "utf8"));
const packDir = mkdtempSync(join(tmpdir(), "retouch-smoke-"));

try {
  for (const pkg of packages) {
    const dir = join(root, pkg.dir);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    console.log(`\n${manifest.name} ${manifest.version}`);

    // 1. The build loads, and exports what users import.
    const mod = await import(pathToFileURL(join(dir, "dist/index.js")).href);
    for (const name of pkg.exports) check(name in mod, `dist exports ${name}`);
    if (manifest.name === core.name) {
      check(
        mod.VERSION === core.version,
        `VERSION is ${mod.VERSION} (package.json ${core.version})`,
      );
    }

    // 2. The tarball holds what it should, and nothing from the repository's own setup.
    const packed = run("pnpm", ["pack", "--pack-destination", packDir], dir);
    if (!packed.ok) {
      check(false, `pnpm pack\n${packed.out}`);
      continue;
    }
    const tarball = packed.out.trim().split("\n").pop();
    const files = run("tar", ["-tzf", tarball])
      .out.trim()
      .split("\n")
      .map((f) => f.replace(/^package\//, ""));
    const shipped = JSON.parse(run("tar", ["-xOzf", tarball, "package/package.json"]).out);
    console.log(`  (${files.length} files)`);

    for (const file of ["package.json", "README.md", "LICENSE", ...pkg.files]) {
      check(files.includes(file), `contains ${file}`);
    }
    const stray = files.filter((f) => /^(src|tests)\/|tsconfig|tsdown\.config/.test(f));
    check(
      stray.length === 0,
      `no source, tests or build config${stray.length ? `: ${stray}` : ""}`,
    );
    check(
      JSON.stringify(shipped.exports).includes("./dist/index.js") &&
        !JSON.stringify(shipped.exports).includes("./src/"),
      "exports point at dist/, not src/",
    );
    check(!JSON.stringify(shipped).includes("workspace:"), "no workspace: ranges left");
    const peer = shipped.peerDependencies?.[core.name];
    if (peer) check(peer === `^${core.version}`, `peer ${core.name} is ${peer}`);

    // ONNX Runtime's proxy worker loads the file ONNX Runtime lives in. A static import would pull
    // it into the app's main bundle, and the worker would then run the whole app and die.
    if (manifest.name.endsWith("-ml")) {
      const code = readFileSync(join(dir, "dist/index.js"), "utf8");
      check(
        !/from\s*["']onnxruntime-web["']/.test(code) &&
          /import\(\s*["']onnxruntime-web["']\s*\)/.test(code),
        "loads onnxruntime-web with a dynamic import only",
      );
    }

    // 3. The packaging tools agree.
    const lint = run(bin("publint"), ["run", dir, "--pack", "pnpm", "--strict"]);
    check(lint.ok, `publint${lint.ok ? "" : `\n${lint.out}`}`);
    const types = run(bin("attw"), [tarball, "--profile", "esm-only", "--format", "ascii"]);
    check(types.ok, `Are the Types Wrong (ESM only)${types.ok ? "" : `\n${types.out}`}`);
  }
} finally {
  rmSync(packDir, { recursive: true, force: true });
}

console.log("");
if (failures > 0) {
  console.error(`smoke: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("smoke: all checks passed");

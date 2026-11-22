import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as ml from "../src/index";

interface ModelFile {
  constant: string;
  url: string;
  size: number;
  sha256: string;
}

interface ModelRecord {
  model: string;
  license: string;
  copyrightLines: string[];
  pinRevision: string;
  files: ModelFile[];
}

const root = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const { models } = JSON.parse(read("third-party-models.json")) as { models: ModelRecord[] };
const files = models.flatMap((m) => m.files);
const notices = read("THIRD_PARTY_NOTICES.md");

/** Licenses a default model may carry. Anything else has to be a host's choice via `modelUrl`. */
const PERMISSIVE = new Set(["Apache-2.0", "MIT", "BSD-3-Clause"]);

describe("third-party model records", () => {
  it("records every default URL the package exports", () => {
    const exported = Object.entries(ml).filter(([name]) => /^DEFAULT_\w+_URL$/.test(name));
    expect(exported.length).toBeGreaterThan(0);
    expect(Object.fromEntries(files.map((f) => [f.constant, f.url]))).toEqual(
      Object.fromEntries(exported),
    );
  });

  it("records every model address written in the source", () => {
    const sources = readdirSync(resolve(root, "src")).filter((name) => name.endsWith(".ts"));
    const urls = sources.flatMap(
      (name) =>
        read(`src/${name}`).match(
          /https:\/\/(?:huggingface\.co|[\w.]*githubusercontent\.com)\/[^"`\s$]+/g,
        ) ?? [],
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(
        files.some((f) => f.url.startsWith(url)),
        url,
      ).toBe(true);
    }
  });

  it("pins every file to a commit and records its hash", () => {
    for (const { model, pinRevision, files: modelFiles } of models) {
      expect(pinRevision, model).toMatch(/^[0-9a-f]{40}$/);
      for (const file of modelFiles) {
        expect(file.url, model).toContain(`/${pinRevision}/`);
        expect(file.sha256, model).toMatch(/^[0-9a-f]{64}$/);
        expect(file.size, model).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the defaults under permissive licenses", () => {
    for (const { model, license } of models) {
      for (const id of license.split(" OR ")) {
        expect(PERMISSIVE.has(id), `${model}: ${id}`).toBe(true);
      }
    }
  });

  it("names every model, copyright line and pin in the notices", () => {
    for (const { model, copyrightLines, pinRevision } of models) {
      expect(notices).toContain(`| ${model} |`);
      expect(notices).toContain(pinRevision.slice(0, 7));
      for (const line of copyrightLines) {
        expect(notices).toContain(line);
      }
    }
  });

  it("ships the records with the package", () => {
    const pkg = JSON.parse(read("package.json")) as {
      files: string[];
      exports: Record<string, unknown>;
    };
    expect(pkg.files).toEqual(
      expect.arrayContaining(["THIRD_PARTY_NOTICES.md", "third-party-models.json"]),
    );
    expect(pkg.exports["./third-party-models.json"]).toBe("./third-party-models.json");
  });
});

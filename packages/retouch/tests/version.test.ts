import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { VERSION } from "../src/constants";

describe("VERSION", () => {
  it("matches package.json (scripts/sync-version.mjs writes it on each release)", () => {
    expect(VERSION).toBe(pkg.version);
  });
});

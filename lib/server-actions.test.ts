import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Security review guard (KAN-69): every Server Action checks who is calling, directly or through
// a helper in the same file. Log-in and sign-up actions are the only public ones.
const PUBLIC_ACTION_FILES = ["app/(auth)/actions.ts"];
const AUTH = /\b(requireUser|requireAdmin|requireProfile|getUser)\(/;

const files = execSync(`grep -rl '^"use server"' app lib components`, { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !PUBLIC_ACTION_FILES.includes(f));

/** Top-level functions of a file with their bodies (up to the next top-level declaration). */
function functions(source: string) {
  const re = /^(?:export )?async function (\w+)\s*[<(]/gm;
  const found: { name: string; exported: boolean; body: string }[] = [];
  const matches = [...source.matchAll(re)];
  matches.forEach((m, i) => {
    const end = matches[i + 1]?.index ?? source.length;
    found.push({
      name: m[1]!,
      exported: m[0].startsWith("export"),
      body: source.slice(m.index!, end),
    });
  });
  return found;
}

describe("server actions", () => {
  it("found the action files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s checks the user in every action", (file) => {
    const fns = functions(readFileSync(file, "utf8"));
    const guarded = new Set(fns.filter((f) => AUTH.test(f.body)).map((f) => f.name));
    const unchecked = fns
      .filter((f) => f.exported)
      .filter((f) => !guarded.has(f.name) && ![...guarded].some((g) => f.body.includes(`${g}(`)))
      .map((f) => f.name);
    expect(unchecked).toEqual([]);
  });
});

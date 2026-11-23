#!/usr/bin/env bun
// Compares standards/core.md across the five owner .github repositories.
// Runs locally only: it needs gh logged in as both deathpie and simpsonm09,
// because no single token can read every owner (homelab's .github is private).
// gh runs from the temp directory so the per-owner gh wrapper picks the token
// from the target owner instead of refusing a cross-account call.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const owners = ["deathpie", "awepeeps", "sakuragaoka-homelab", "simpsonm09", "simpsonm09-projects"];

const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);

function run(cmd: string[]): string {
  const p = Bun.spawnSync(cmd, { cwd: tmpdir(), stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`${cmd.join(" ")}: ${p.stderr.toString().trim()}`);
  return p.stdout.toString();
}

const local = sha(readFileSync("standards/core.md", "utf8"));
let drift = false;
for (const owner of owners) {
  let hash: string;
  try {
    const body = run(["gh", "api", "-H", "Accept: application/vnd.github.raw", `repos/${owner}/.github/contents/standards/core.md`]);
    hash = sha(body);
  } catch (error) {
    hash = `unreadable (${(error as Error).message.split("\n")[0]})`;
  }
  const same = hash === local;
  if (!same) drift = true;
  console.log(`${same ? "ok   " : "DRIFT"} ${owner.padEnd(22)} ${hash}`);
}
console.log(`local                        ${local}`);
process.exit(drift ? 1 : 0);

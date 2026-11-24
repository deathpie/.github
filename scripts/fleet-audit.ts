#!/usr/bin/env bun
// Read-only fleet audit against standards/core.md and standards/owner.md.
//
// Checks every repository of the five owners: settings, rulesets, security,
// required files, the hooks tag, Linux-only runners, PowerShell/Python
// leftovers, the C5.7 required-check policy, the C5.8 runner placement and,
// with --timing, the C5.1 median pull request CI wall time.
// Every gap names the rule it violates. A gap recorded in the repository's
// docs/exceptions.md is reported as excepted and does not fail the run.
// --timing also reports a C5.1 gap when the median is 60 s or more; a
// repository with no pull request runs has no measured median and no gap.
// C5.7 compares a required check against the hook recipe names, so the check
// has to carry the recipe's name; the owner standard's `## CI-only required
// checks` section names the ones that are allowed to differ.
//
// gh runs from the temp directory so the per-owner gh wrapper picks the token
// from the target owner instead of refusing a cross-account call. This script
// only issues GET requests and never prints a token or a secret value.
import { tmpdir } from "node:os";

// Keep this list, and its order, identical to `owners` in scripts/core-drift.ts.
// Both files keep a literal list so each runs standalone.
const owners = ["deathpie", "awepeeps", "sakuragaoka-homelab", "simpsonm09", "simpsonm09-projects"] as const;

type Owner = (typeof owners)[number];

type GhResult = { ok: boolean; json: any };
type Gap = { rules: string[]; message: string; neverExcepted?: boolean };
type Report = {
  repo: string;
  owner: Owner;
  visibility: string;
  fork: boolean;
  medianSeconds: number | null;
  gaps: (Gap & { excepted: boolean })[];
  error?: string;
};

const usage = (message: string): never => {
  console.error(`fleet-audit: ${message}`);
  console.error("usage: bun scripts/fleet-audit.ts [--timing] [--owner <owner>] [--json]");
  process.exit(2);
};

function gh(args: string[]): GhResult {
  const p = Bun.spawnSync(["gh", ...args], { cwd: tmpdir(), stdout: "pipe", stderr: "pipe" });
  const text = p.stdout.toString().trim();
  let json: any = null;
  if (p.exitCode === 0 && text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { ok: p.exitCode === 0, json };
}

const api = (path: string): any => gh(["api", path]).json;

function raw(repo: string, path: string, ref: string): string | null {
  const p = Bun.spawnSync(
    ["gh", "api", "-H", "Accept: application/vnd.github.raw", `repos/${repo}/contents/${path}?ref=${ref}`],
    { cwd: tmpdir(), stdout: "pipe", stderr: "pipe" },
  );
  return p.exitCode === 0 ? p.stdout.toString() : null;
}

// The exception table is `| Rule | Reason | Revisit |`. The rule cell may hold
// several comma-separated ids, with or without backticks: `C2.2, C5.1`.
function exceptionsFor(repo: string, ref: string): Set<string> {
  const body = raw(repo, "docs/exceptions.md", ref);
  const ids = new Set<string>();
  if (body === null) return ids;
  for (const line of body.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const first = cells[0] ?? "";
    if (!first || first.toLowerCase() === "rule") continue;
    if (/^:?-+:?$/.test(first.replace(/\s/g, ""))) continue;
    for (const match of first.matchAll(/\b[A-Z]\d+(?:\.\d+)?\b/g)) ids.add(match[0]);
  }
  return ids;
}

// C5.1: median wall time over the last 20 pull request head SHAs, from the
// first workflow start to the last finish. CodeQL default setup ("dynamic")
// runs are not required checks and are excluded.
function medianSeconds(repo: string): number | null {
  const runs = api(`repos/${repo}/actions/runs?event=pull_request&per_page=100`)?.workflow_runs ?? [];
  const bySha = new Map<string, { start: number; end: number; when: number }>();
  for (const run of runs) {
    if (run.status !== "completed" || String(run.path ?? "").startsWith("dynamic/")) continue;
    const start = Date.parse(run.run_started_at);
    const end = Date.parse(run.updated_at);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const current = bySha.get(run.head_sha) ?? { start, end, when: start };
    current.start = Math.min(current.start, start);
    current.end = Math.max(current.end, end);
    current.when = Math.max(current.when, start);
    bySha.set(run.head_sha, current);
  }
  const recent = [...bySha.values()].sort((a, b) => b.when - a.when).slice(0, 20);
  if (!recent.length) return null;
  const walls = recent.map((run) => Math.round((run.end - run.start) / 1000)).sort((a, b) => a - b);
  return walls[Math.floor(walls.length / 2)];
}

const unquote = (value: string): string => value.trim().replace(/^["']|["']$/g, "");

// C5.8: every `runs-on:` value in a workflow, inline (`runs-on: ubuntu-latest`)
// or as a block list (`runs-on:` then `- self-hosted`). A matrix expression is
// not a label, so it counts as neither kind.
function runnersIn(body: string): string[] {
  const values: string[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^\s*runs-on:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const inline = match[1].replace(/#.*$/, "").trim();
    if (inline) {
      values.push(inline);
      continue;
    }
    for (let j = i + 1; j < lines.length; j += 1) {
      const item = /^\s*-\s*(.+)$/.exec(lines[j]);
      if (!item) break;
      values.push(item[1].replace(/#.*$/, "").trim());
    }
  }
  return values;
}

// C5.7: a required context is `workflow / job` or just the job name. The job
// part is what has to be a hook recipe.
function jobPart(context: string): string {
  const name = context.trim();
  return name.includes(" / ") ? name.slice(name.lastIndexOf(" / ") + 3) : name;
}

const hookRecipes = ["fmt", "fmt-check", "lint", "typecheck", "test", "secrets", "privacy", "hooks"];

function isHookRecipe(context: string): boolean {
  const name = jobPart(context).toLowerCase();
  if (hookRecipes.includes(name)) return true;
  // A matrix or shard suffix keeps the recipe: `test (unit)`, `fmt fast`.
  return /^(fmt|fmt-check|lint|typecheck|test|secrets|privacy|hooks)[\s(]/.test(name);
}

// The owner standard's `## CI-only required checks` section names the required
// contexts the hook recipes cannot run. Names are backticked, one per item,
// with or without a `workflow / ` prefix.
function ciOnlyChecks(ownerStandard: string | null): Set<string> {
  const names = new Set<string>();
  if (ownerStandard === null) return names;
  const add = (value: string) => {
    const name = value.trim().toLowerCase();
    if (!name) return;
    names.add(name);
    names.add(jobPart(name).toLowerCase());
  };
  let inside = false;
  for (const line of ownerStandard.split("\n")) {
    if (/^##\s/.test(line)) {
      inside = /^##\s+CI-only required checks\s*$/i.test(line);
      continue;
    }
    if (!inside) continue;
    for (const match of line.matchAll(/`([^`]+)`/g)) add(match[1]);
    if (!line.includes("`")) {
      const bullet = /^\s*[-*]\s+([^\s—–:]+)/.exec(line);
      if (bullet) add(bullet[1]);
    }
  }
  return names;
}

// The owner standard is that owner's `.github` repository's
// `standards/owner.md`, fetched once per owner: a full-fleet run from one clone
// applies each owner's own policy, not the local one.
const ownerStandards = new Map<Owner, string | null>();

function ownerStandard(owner: Owner): string | null {
  if (!ownerStandards.has(owner)) {
    const branch = api(`repos/${owner}/.github`)?.default_branch ?? "main";
    ownerStandards.set(owner, raw(`${owner}/.github`, "standards/owner.md", branch));
  }
  return ownerStandards.get(owner) ?? null;
}

// A workflow triggers on pull requests when its `on:` block names
// `pull_request` (not `pull_request_target`, whose underscore is not a word
// boundary).
function onPullRequest(body: string): boolean {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^on:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const inline = match[1].replace(/#.*$/, "").trim();
    if (inline) return /\bpull_request\b/.test(inline);
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\S/.test(lines[j])) break;
      if (/^\s+pull_request\b/.test(lines[j])) return true;
    }
    return false;
  }
  return false;
}

// The check contexts a workflow reports: each job's `name:` when it has one,
// otherwise the job id. Job ids sit at two spaces under `jobs:`. A job whose
// `if:` skips pull requests is not a pull-request check.
function jobNames(body: string): string[] {
  const jobs: { name: string; skipsPullRequests: boolean }[] = [];
  let inJobs = false;
  for (const line of body.split("\n")) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(line)) {
      inJobs = false;
      continue;
    }
    const id = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (id) {
      jobs.push({ name: id[1], skipsPullRequests: false });
      continue;
    }
    if (jobs.length === 0) continue;
    const display = /^    name:\s*(.+)$/.exec(line);
    if (display) jobs[jobs.length - 1].name = unquote(display[1].replace(/#.*$/, "").trim());
    const condition = /^    if:\s*(.+)$/.exec(line);
    if (condition && /pull_request/.test(condition[1]) && /!=|!\s*contains/.test(condition[1])) {
      jobs[jobs.length - 1].skipsPullRequests = true;
    }
  }
  return jobs.filter((job) => !job.skipsPullRequests).map((job) => job.name);
}

// C5.7: the required pull-request contexts. A public repository takes them
// from every ruleset's `required_status_checks` rule. A private repository on
// Free has no rulesets, so its contexts are the jobs of the pull-request checks
// workflow, the one that runs `just check`.
function requiredContexts(
  full: string,
  pub: boolean,
  workflows: string[],
  read: (path: string) => string | null,
): string[] {
  if (pub) {
    const contexts: string[] = [];
    for (const ruleset of api(`repos/${full}/rulesets`) ?? []) {
      if (ruleset.target && ruleset.target !== "branch") continue;
      const detail = api(`repos/${full}/rulesets/${ruleset.id}`);
      for (const rule of detail?.rules ?? []) {
        if (rule.type !== "required_status_checks") continue;
        for (const check of rule.parameters?.required_status_checks ?? []) {
          if (typeof check.context === "string") contexts.push(check.context);
        }
      }
    }
    return contexts;
  }
  const pullRequests = workflows.filter((workflow) => onPullRequest(read(workflow) ?? ""));
  if (pullRequests.length === 0) return [];
  const checks =
    pullRequests.find((workflow) => /\bjust\s+check\b/.test(read(workflow) ?? "")) ??
    pullRequests.find((workflow) => /\/checks?\.ya?ml$/.test(workflow)) ??
    (pullRequests.length === 1 ? pullRequests[0] : null);
  return checks === null ? [] : jobNames(read(checks) ?? "");
}

function audit(owner: Owner, listed: any, timing: boolean): Report {
  const name = listed.name;
  const full = `${owner}/${name}`;
  const visibility = String(listed.visibility ?? "").toLowerCase();
  const report: Report = {
    repo: full,
    owner,
    visibility,
    fork: listed.isFork === true,
    medianSeconds: null,
    gaps: [],
  };

  const repo = api(`repos/${full}`);
  if (!repo) return { ...report, error: "repository unreadable" };

  const gaps: Gap[] = [];
  const def = repo.default_branch;
  const effectiveVisibility = String(repo.visibility ?? visibility).toLowerCase();
  const pub = effectiveVisibility === "public";
  const fork = repo.fork === true;
  report.visibility = effectiveVisibility;
  report.fork = fork;
  const isDotGithub = name === ".github" || name === ".github-private";

  const cache = new Map<string, string | null>();
  const read = (path: string): string | null => {
    if (!cache.has(path)) cache.set(path, raw(full, path, def));
    return cache.get(path) ?? null;
  };

  if (repo.allow_merge_commit || repo.allow_rebase_merge || !repo.allow_squash_merge) {
    gaps.push({ rules: ["C2.3"], message: "not squash-only" });
  }
  if (!repo.delete_branch_on_merge) gaps.push({ rules: ["C2.6"], message: "no delete-branch" });
  if (!repo.allow_update_branch) gaps.push({ rules: ["C2.6"], message: "no update-branch" });
  if (repo.has_wiki) gaps.push({ rules: ["C1.5"], message: "wiki on" });
  if (repo.has_projects) gaps.push({ rules: ["C1.5"], message: "projects on" });
  if (!repo.description) gaps.push({ rules: ["C1.2"], message: "no description" });
  if (pub && !repo.allow_auto_merge) gaps.push({ rules: ["C3.3"], message: "no native auto-merge" });

  if (pub) {
    const analysis = repo.security_and_analysis ?? {};
    if (analysis.secret_scanning?.status !== "enabled") {
      gaps.push({ rules: ["C6.1"], message: "secret scanning off" });
    }
    if (analysis.secret_scanning_push_protection?.status !== "enabled") {
      gaps.push({ rules: ["C6.1"], message: "push protection off" });
    }

    // Default setup returns no languages when CodeQL cannot scan the tree.
    // Such a repository is not expected to have CodeQL on.
    const codeql = api(`repos/${full}/code-scanning/default-setup`);
    const languages = Array.isArray(codeql?.languages) ? codeql.languages : [];
    if (languages.length > 0 && codeql?.state !== "configured") {
      gaps.push({ rules: ["C6.1"], message: "codeql default off" });
    }

    const rulesets = api(`repos/${full}/rulesets`) ?? [];
    const protectMain = rulesets.find((ruleset: any) => ruleset.name === "protect-main");
    if (!protectMain) {
      gaps.push({ rules: ["C2.1"], message: "no protect-main ruleset" });
    } else {
      const detail = api(`repos/${full}/rulesets/${protectMain.id}`);
      if (!detail) {
        gaps.push({ rules: ["C2.1"], message: "protect-main unreadable" });
      } else {
        if (detail.bypass_actors?.length) gaps.push({ rules: ["C2.1"], message: "ruleset bypass actors" });
        const pullRequest = detail.rules?.find((rule: any) => rule.type === "pull_request");
        if (JSON.stringify(pullRequest?.parameters?.allowed_merge_methods) !== '["squash"]') {
          gaps.push({ rules: ["C2.3"], message: "ruleset not squash-only" });
        }
        const checks = detail.rules?.find((rule: any) => rule.type === "required_status_checks");
        const contexts =
          checks?.parameters?.required_status_checks?.map((check: any) => check.context) ?? [];
        const hasWorkflows = gh(["api", `repos/${full}/contents/.github/workflows?ref=${def}`]).ok;
        if (hasWorkflows && read("lefthook.yml") !== null && !contexts.includes("hooks")) {
          gaps.push({ rules: ["C7.9"], message: "hooks not required" });
        }
      }
    }
  }

  if (!gh(["api", `repos/${full}/vulnerability-alerts`]).ok) {
    gaps.push({ rules: ["C3.1"], message: "dependabot alerts off" });
  }
  if (api(`repos/${full}/automated-security-fixes`)?.enabled !== true) {
    gaps.push({ rules: ["C3.1"], message: "security fixes off" });
  }
  const actions = api(`repos/${full}/actions/permissions`);
  if (actions?.enabled && !actions?.sha_pinning_required) {
    gaps.push({ rules: ["C4.1"], message: "sha pinning not required" });
  }

  const tree = api(`repos/${full}/git/trees/${def}?recursive=1`)?.tree ?? [];
  const paths = new Set<string>(tree.map((entry: any) => entry.path));
  const shas = new Map<string, string>(tree.map((entry: any) => [entry.path, entry.sha]));
  const has = (path: string) => paths.has(path);

  for (const [file, rule] of [
    ["AGENTS.md", "C8.1"],
    ["favicon.svg", "C1.3"],
    ["mise.toml", "C7.2"],
    ["justfile", "C7.1"],
    [".editorconfig", "C7.7"],
    [".gitattributes", "C7.7"],
  ] as const) {
    if (!has(file)) gaps.push({ rules: [rule], message: `missing ${file}` });
  }

  if (!isDotGithub || name === ".github-private") {
    const lefthook = read("lefthook.yml");
    if (lefthook === null) gaps.push({ rules: ["C7.8"], message: "missing lefthook.yml" });
    else if (!/ref:\s*["']?hooks-v3["']?/.test(lefthook)) gaps.push({ rules: ["C7.8"], message: "lefthook not hooks-v3" });
  }

  if (has("CLAUDE.md")) gaps.push({ rules: ["C8.1"], message: "standalone CLAUDE.md" });

  // A fork keeps upstream's non-Linux code and workflows (C5.6). Only a file
  // the fork added or changed is its own; inherited files are not gaps.
  let upstream: Map<string, string> | null = null;
  if (fork && repo.parent?.full_name) {
    const parentBranch = repo.parent.default_branch ?? "main";
    const parentTree = api(
      `repos/${repo.parent.full_name}/git/trees/${parentBranch}?recursive=1`,
    )?.tree;
    if (Array.isArray(parentTree)) {
      upstream = new Map<string, string>(parentTree.map((entry: any) => [entry.path, entry.sha]));
    }
  }
  const ownFile = (path: string) => !upstream || upstream.get(path) !== shas.get(path);

  const workflows = [...paths].filter((path) => /^\.github\/workflows\/.*\.ya?ml$/.test(path));
  const ownWorkflows = !fork || upstream !== null ? workflows.filter(ownFile) : null;
  if (workflows.length > 0) {
    if (!has(".github/dependabot.yml")) gaps.push({ rules: ["C3.2"], message: "no dependabot.yml" });
    // Without the upstream tree there is no way to tell an inherited workflow
    // from the fork's own, so only audit runners when the tree is readable.
    if (ownWorkflows !== null) {
      let nonLinux = 0;
      for (const workflow of ownWorkflows) {
        if (/(windows|macos)-(latest|\d)/.test(read(workflow) ?? "")) nonLinux += 1;
      }
      if (nonLinux > 0) {
        gaps.push({ rules: ["C5.6"], message: `${nonLinux} workflow(s) on non-Linux runners` });
      }

      // C5.8: where CI runs. A public repository never runs on self-hosted
      // runners, and no exception can allow it. An organization's private
      // repositories run on its self-hosted Linux runners; a personal account
      // cannot register account-wide runners, so its private repositories use
      // GitHub-hosted runners and are not flagged for them.
      const runners = ownWorkflows.flatMap((workflow) => runnersIn(read(workflow) ?? "")).map(unquote);
      const selfHosted = runners.some((runner) => /\bself-hosted\b/.test(runner));
      const githubHosted = runners.some((runner) => /^(ubuntu|windows|macos)-/.test(runner));
      if (pub && selfHosted) {
        gaps.push({
          rules: ["C5.8"],
          message: "public repository on a self-hosted runner",
          neverExcepted: true,
        });
      }
      const organization = String(repo.owner?.type ?? "").toLowerCase() === "organization";
      if (!pub && organization && githubHosted) {
        gaps.push({
          rules: ["C5.8"],
          message: "private organization repository on GitHub-hosted runners",
        });
      }
    }
  }

  // C5.7: the required pull-request checks are the hook recipes, unless the
  // owner standard names them under `## CI-only required checks`.
  const ciOnly = ciOnlyChecks(ownerStandard(owner));
  for (const context of requiredContexts(full, pub, workflows, read)) {
    const name = context.trim().toLowerCase();
    if (isHookRecipe(context) || ciOnly.has(name) || ciOnly.has(jobPart(name))) continue;
    gaps.push({ rules: ["C5.7"], message: `required check ${context} is not a hook recipe` });
  }

  // C7.4 is the core language rule; the homelab standard restates it as H6 and
  // records its Python and PowerShell exceptions under that id. A fork keeps
  // upstream's platform code (C5.6), so language leftovers are audited only in
  // non-fork repositories; a fork's own workflows are checked above.
  const languageRules = owner === "sakuragaoka-homelab" ? ["C7.4", "H6"] : ["C7.4"];
  const windowsTarget = name === "parents-windows-pc";
  const powershell = [...paths].filter((path) => /\.(ps1|psm1|cmd|bat)$/i.test(path));
  if (powershell.length > 0 && !windowsTarget && !fork) {
    gaps.push({ rules: languageRules, message: `${powershell.length} PowerShell/cmd files` });
  }
  const python = [...paths].filter((path) => path.endsWith(".py"));
  if (python.length > 0 && !fork) {
    gaps.push({ rules: languageRules, message: `${python.length} Python files` });
  }

  if (timing) {
    report.medianSeconds = medianSeconds(full);
    if (report.medianSeconds !== null && report.medianSeconds >= 60) {
      gaps.push({ rules: ["C5.1"], message: `median ${report.medianSeconds}s over 60s` });
    }
  }

  const excepted = gaps.length > 0 ? exceptionsFor(full, def) : new Set<string>();
  report.gaps = gaps.map(({ neverExcepted, ...gap }) => ({
    ...gap,
    excepted: neverExcepted !== true && gap.rules.some((rule) => excepted.has(rule)),
  }));
  return report;
}

const argv = process.argv.slice(2);
let timing = false;
let jsonOut = false;
let onlyOwner: Owner | null = null;
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--timing") timing = true;
  else if (arg === "--json") jsonOut = true;
  else if (arg === "--owner") {
    const value = argv[i + 1];
    if (!value) usage("--owner needs an owner");
    onlyOwner = value as Owner;
    i += 1;
  } else if (arg.startsWith("--owner=")) {
    onlyOwner = arg.slice("--owner=".length) as Owner;
  } else {
    usage(`unknown argument: ${arg}`);
  }
}
if (onlyOwner !== null && !owners.includes(onlyOwner)) {
  usage(`unknown owner: ${onlyOwner} (one of ${owners.join(", ")})`);
}

const scope: readonly Owner[] = onlyOwner ? [onlyOwner] : owners;
const reports: Report[] = [];
for (const owner of scope) {
  const listing = gh([
    "repo",
    "list",
    owner,
    "--no-archived",
    "--limit",
    "100",
    "--json",
    "name,visibility,isFork",
  ]);
  if (!listing.ok || !Array.isArray(listing.json)) {
    console.error(`fleet-audit: cannot list repositories for ${owner}`);
    process.exit(1);
  }
  for (const listed of [...listing.json].sort((a: any, b: any) => a.name.localeCompare(b.name))) {
    reports.push(audit(owner, listed, timing));
  }
}

const failed = reports.filter(
  (report) => report.error !== undefined || report.gaps.some((gap) => !gap.excepted),
);

if (jsonOut) {
  console.log(JSON.stringify({ owners: scope, timing, repos: reports }, null, 2));
} else {
  const header = ["repo", "visibility", ...(timing ? ["median_s"] : []), "gaps"];
  console.log(header.join("\t"));
  for (const report of reports) {
    const visibility = `${report.visibility}${report.fork ? ",fork" : ""}`;
    const cells = [report.repo, visibility];
    if (timing) cells.push(report.medianSeconds === null ? "-" : String(report.medianSeconds));
    if (report.error) cells.push(`error: ${report.error}`);
    else if (report.gaps.length === 0) cells.push("OK");
    else {
      cells.push(
        report.gaps
          .map((gap) => `${gap.rules.join("/")} ${gap.message}${gap.excepted ? " (excepted)" : ""}`)
          .join("; "),
      );
    }
    console.log(cells.join("\t"));
  }
}

process.exit(failed.length > 0 ? 1 : 0);

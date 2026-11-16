#!/usr/bin/env node
// Benchmark harness. No dependencies: Node 20+ and the GitHub CLI (`gh`), logged in
// with access to the repository that holds these workflows.
//
//   node harness/bench.mjs one <project> <runner-id> [--branch name]   one run, for trying a workflow
//   node harness/bench.mjs series <series-name> [options]              the full cold and warm series
//   node harness/bench.mjs summarize <series-name>                     results/summary.json and .md
//   node harness/bench.mjs minutes                                     billed minutes used by this repo's runs
//   node harness/bench.mjs cleanup <series-name>                       delete the series' branches and caches
//
// Every time in the results comes from the GitHub REST API after the run has finished
// (the run, its job and the job's steps). Nothing is timed inside the job.

import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize } from "./summarize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "results", "raw");
const PROJECTS = JSON.parse(readFileSync(join(ROOT, "projects.json"), "utf8"));
const CONFIG = JSON.parse(readFileSync(join(ROOT, "runners.json"), "utf8"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => console.log(new Date().toISOString(), ...parts);
const seconds = (from, to) => (from && to ? Math.round((new Date(to) - new Date(from)) / 1000) : null);

function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 256 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${cmd} ${args.join(" ")}: ${stderr || error.message}`));
      else resolve(stdout);
    });
  });
}

/** `gh api`, retried on anything that looks transient. Returns parsed JSON, or text with { text: true }. */
async function api(path, { method = "GET", fields = {}, text = false, tries = 4 } = {}) {
  const args = ["api", "-X", method, path];
  for (const [key, value] of Object.entries(fields)) args.push("-f", `${key}=${value}`);
  for (let attempt = 1; ; attempt++) {
    try {
      const out = await sh("gh", args);
      if (text) return out;
      return out.trim() ? JSON.parse(out) : null;
    } catch (error) {
      const message = String(error.message);
      const permanent = /HTTP 40[0-49]|HTTP 422/.test(message);
      if (permanent || attempt >= tries) throw error;
      await sleep(5000 * attempt);
    }
  }
}

let repoName;
async function repo() {
  repoName ??= process.env.BENCH_REPO ?? (await sh("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])).trim();
  return repoName;
}

function flag(argv, name, fallback) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : argv[at + 1];
}

// ---------------------------------------------------------------- branches and caches

async function mainSha() {
  const ref = await api(`repos/${await repo()}/git/ref/heads/main`);
  return ref.object.sha;
}

async function ensureBranch(branch, sha) {
  try {
    await api(`repos/${await repo()}/git/ref/heads/${branch}`, { tries: 1 });
  } catch {
    await api(`repos/${await repo()}/git/refs`, { method: "POST", fields: { ref: `refs/heads/${branch}`, sha } });
  }
}

/** Deletes a branch and the GitHub-side Actions caches saved from it. */
async function dropBranch(branch) {
  const name = await repo();
  try {
    const found = await api(`repos/${name}/actions/caches?per_page=100&ref=refs/heads/${branch}`);
    for (const cache of found?.actions_caches ?? []) {
      await api(`repos/${name}/actions/caches/${cache.id}`, { method: "DELETE", tries: 2 }).catch(() => {});
    }
    await api(`repos/${name}/git/refs/heads/${branch}`, { method: "DELETE", tries: 2 });
  } catch (error) {
    log("could not drop branch", branch, String(error.message).slice(0, 200));
  }
}

// ---------------------------------------------------------------- one run

const CACHE_HIT = /cache restored|cache hit|restored from cache|restored cache|cache up-to-date|restoring cache|importing cache manifest/i;
const CACHE_MISS = /cache not found|no cache found|cache miss|cache is not found|not found in cache|no cache is found/i;

function readLog(text) {
  const machine = {};
  const cache = [];
  let cachedLayers = 0;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^\S+Z\s/, "").replace(/\u001b\[[0-9;]*m/g, "").trim();
    const info = /bench-info (\w+)=(.*)$/.exec(line);
    if (info && !line.includes("echo")) machine[info[1]] = info[2];
    if (/^#\d+ CACHED/.test(line)) cachedLayers++;
    if (cache.length < 40 && line.length < 300 && (CACHE_HIT.test(line) || CACHE_MISS.test(line))) cache.push(line);
  }
  if (machine.nproc) machine.nproc = Number(machine.nproc);
  if (machine.mem_kb) machine.mem_gb = Math.round((Number(machine.mem_kb) / 1024 / 1024) * 10) / 10;
  delete machine.mem_kb;
  return {
    machine,
    cache: { restored: cache.some((line) => CACHE_HIT.test(line) && !CACHE_MISS.test(line)), docker_cached_layers: cachedLayers, lines: cache },
  };
}

/**
 * Dispatches one workflow run, waits for it and returns the record that goes in results/raw.
 * `slot` is { project, runner, kind, n, attempt, branch, series }.
 */
async function runOnce(slot, harnessSha) {
  const name = await repo();
  const project = PROJECTS.find((entry) => entry.id === slot.project.id);
  const tag = `${slot.series}/${project.id}/${slot.runner.id}/${slot.kind}-${slot.n}/a${slot.attempt}/${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    schema: 1,
    series: slot.series,
    project: project.id,
    project_repo: project.repo,
    project_commit: project.commit,
    runner_id: slot.runner.id,
    runner_label: slot.runner.label,
    provider: slot.runner.provider,
    kind: slot.kind,
    n: slot.n,
    attempt: slot.attempt,
    primes_warm_cache: slot.prime === true,
    branch: slot.branch,
    tag,
    harness_commit: harnessSha,
    dispatched_at: new Date().toISOString(),
    status: "error",
  };
  try {
    await ensureBranch(slot.branch, harnessSha);
    await api(`repos/${name}/actions/workflows/${project.workflow}/dispatches`, {
      method: "POST",
      fields: { ref: slot.branch, "inputs[runner]": slot.runner.label, "inputs[tag]": tag },
    });

    let run;
    for (let waited = 0; !run && waited < 180; waited += 5) {
      await sleep(5000);
      const list = await api(`repos/${name}/actions/workflows/${project.workflow}/runs?event=workflow_dispatch&per_page=20&branch=${encodeURIComponent(slot.branch)}`);
      run = list.workflow_runs.find((candidate) => (candidate.display_title ?? candidate.name ?? "").endsWith(tag));
    }
    if (!run) throw new Error("the run did not appear within 3 minutes of the dispatch");
    log("started", tag, run.html_url);

    const deadline = Date.now() + 50 * 60 * 1000;
    while (run.status !== "completed") {
      if (Date.now() > deadline) {
        await api(`repos/${name}/actions/runs/${run.id}/cancel`, { method: "POST", tries: 1 }).catch(() => {});
        record.note = "cancelled by the harness after 50 minutes";
        await sleep(20000);
      } else {
        await sleep(15000);
      }
      run = await api(`repos/${name}/actions/runs/${run.id}`);
      if (record.note && run.status !== "completed") break;
    }

    const jobs = await api(`repos/${name}/actions/runs/${run.id}/jobs?per_page=100`);
    const job = jobs.jobs[0];
    record.run = {
      id: run.id,
      html_url: run.html_url,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      run_attempt: run.run_attempt,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      created_at: run.created_at,
      run_started_at: run.run_started_at,
      updated_at: run.updated_at,
    };
    if (job) {
      record.job = {
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        runner_name: job.runner_name,
        runner_group_name: job.runner_group_name,
        labels: job.labels,
        steps: job.steps,
      };
      const steps = (job.steps ?? []).map((step) => ({
        name: step.name,
        conclusion: step.conclusion,
        seconds: seconds(step.started_at, step.completed_at),
      }));
      record.derived = {
        // queued -> started: from the job being created to a runner picking it up
        queue_s: seconds(job.created_at ?? run.created_at, job.started_at),
        // queued -> the first step starting, a second view of the same wait
        to_first_step_s: seconds(job.created_at ?? run.created_at, job.steps?.[0]?.started_at),
        // started -> completed: the whole job, setup and post steps included
        job_s: seconds(job.started_at, job.completed_at),
        steps,
      };
      try {
        Object.assign(record, readLog(await api(`repos/${name}/actions/jobs/${job.id}/logs`, { text: true, tries: 3 })));
      } catch (error) {
        record.log_error = String(error.message).slice(0, 200);
      }
    }
    record.status = run.conclusion === "success" && job?.conclusion === "success" ? "ok" : (run.conclusion ?? "incomplete");
  } catch (error) {
    record.error = String(error.message).slice(0, 500);
  }
  return record;
}

function rawPath(record) {
  return join(RAW, `${record.series}__${record.project}__${record.runner_id}__${record.kind}-${record.n}__a${record.attempt}.json`);
}

function save(record) {
  mkdirSync(RAW, { recursive: true });
  writeFileSync(rawPath(record), JSON.stringify(record, null, 2) + "\n");
}

export function loadRaw(series) {
  if (!existsSync(RAW)) return [];
  return readdirSync(RAW)
    .filter((file) => file.endsWith(".json") && (!series || file.startsWith(`${series}__`)))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(RAW, file), "utf8")));
}

const billed = (record) => (record.derived?.job_s ? Math.ceil(record.derived.job_s / 60) : 0);

// ---------------------------------------------------------------- the series

/** Waits while another repository's checks sit queued, so benchmark jobs never starve real work. */
async function waitForGuard() {
  const guard = process.env.BENCH_GUARD_REPO;
  if (!guard) return;
  for (;;) {
    let waiting = [];
    try {
      const queued = await api(`repos/${guard}/actions/runs?status=queued&per_page=20`);
      waiting = queued.workflow_runs.filter((run) => Date.now() - new Date(run.created_at) > 120 * 1000);
    } catch {
      return;
    }
    if (waiting.length === 0) return;
    log(`guard: ${waiting.length} run(s) queued for over 2 minutes in the guarded repository; pausing`);
    await sleep(60000);
  }
}

async function series(name, argv) {
  const only = flag(argv, "projects")?.split(",");
  const lanes = flag(argv, "runners")?.split(",");
  const budget = Number(flag(argv, "max-billed-minutes", "Infinity"));
  const offset = Number(flag(argv, "billed-offset", "0"));
  const maxAttempts = 2;
  const projects = PROJECTS.filter((project) => !only || only.includes(project.id));
  const runners = CONFIG.runners.filter((runner) => !lanes || lanes.includes(runner.id));
  const sha = await mainSha();
  const short = (id) => id.replace(/[^a-z0-9]+/gi, "-");
  let billedUsed = offset + loadRaw().filter((record) => record.series === name && CONFIG.runners.find((r) => r.id === record.runner_id)?.billed_minutes).reduce((sum, record) => sum + billed(record), 0);

  // Rounds: every project once per round, so two runs of one project on one runner are a
  // whole round apart. Cold runs 1..N-1 use a branch of their own; the last cold run is the
  // first run on the warm branch, and it is what fills the cache the warm runs restore.
  const rounds = [];
  for (let n = 1; n < CONFIG.cold_runs; n++) rounds.push({ kind: "cold", n });
  rounds.push({ kind: "cold", n: CONFIG.cold_runs, prime: true });
  for (let n = 1; n <= CONFIG.warm_runs; n++) rounds.push({ kind: "warm", n });

  async function lane(runner) {
    const warmBranch = new Map();
    for (const round of rounds) {
      for (const project of projects) {
        const done = loadRaw(name).filter((r) => r.project === project.id && r.runner_id === runner.id && r.kind === round.kind && r.n === round.n);
        const primes = loadRaw(name).filter((r) => r.project === project.id && r.runner_id === runner.id && r.primes_warm_cache && r.status === "ok");
        if (primes.length) warmBranch.set(project.id, primes.at(-1).branch);
        if (done.some((r) => r.status === "ok")) continue;
        if (round.kind === "warm" && !warmBranch.has(project.id)) {
          log("skip", project.id, runner.id, `warm-${round.n}`, "(no successful priming run)");
          continue;
        }
        for (let attempt = done.length + 1; attempt <= maxAttempts; attempt++) {
          if (runner.billed_minutes && billedUsed >= budget) {
            log(`budget: ${billedUsed} billed minutes used, limit ${budget}; stopping ${runner.id}`);
            return;
          }
          if (!runner.billed_minutes) await waitForGuard();
          const base = `bench/${short(name)}/${project.id}/${runner.id}`;
          const branch =
            round.kind === "warm" ? warmBranch.get(project.id) : round.prime ? `${base}/warm-a${attempt}` : `${base}/cold-${round.n}-a${attempt}`;
          const record = await runOnce({ series: name, project, runner, kind: round.kind, n: round.n, attempt, branch, prime: round.prime }, sha);
          save(record);
          if (runner.billed_minutes) billedUsed += billed(record);
          log("finished", project.id, runner.id, `${round.kind}-${round.n}`, `attempt ${attempt}`, record.status, `queue ${record.derived?.queue_s}s`, `job ${record.derived?.job_s}s`, runner.billed_minutes ? `(billed so far ${billedUsed} min)` : "");
          if (round.kind === "cold" && !round.prime) await dropBranch(branch);
          if (record.status === "ok") {
            if (round.prime) warmBranch.set(project.id, branch);
            break;
          }
        }
      }
    }
    log("lane done", runner.id);
  }

  // One job at a time per runner; the runners advance side by side.
  await Promise.all(runners.map((runner) => lane(runner).catch((error) => log("lane failed", runner.id, error.message))));
  log("series done", name);
}

// ---------------------------------------------------------------- other commands

async function one(argv) {
  const [projectId, runnerId] = argv;
  const project = PROJECTS.find((entry) => entry.id === projectId);
  const runner = CONFIG.runners.find((entry) => entry.id === runnerId) ?? { id: runnerId, label: runnerId, provider: "other" };
  if (!project) throw new Error(`unknown project ${projectId}`);
  const branch = flag(argv, "branch", `bench/try/${project.id}/${runner.id}/${Date.now()}`);
  const record = await runOnce({ series: "try", project, runner, kind: "try", n: 1, attempt: 1, branch }, await mainSha());
  // Trial runs are printed, never written to results/.
  console.log(JSON.stringify({ status: record.status, error: record.error, url: record.run?.html_url, runner: record.job?.runner_name, machine: record.machine, derived: record.derived, cache: record.cache }, null, 2));
  if (!argv.includes("--keep-branch")) await dropBranch(branch);
}

/** Billed minutes of every job in this repository on a runner whose minutes are metered: each job rounded up to a minute. */
async function minutes() {
  const name = await repo();
  const metered = new Set(CONFIG.runners.filter((runner) => runner.billed_minutes).map((runner) => runner.label));
  let total = 0;
  let jobs = 0;
  for (let page = 1; ; page++) {
    const list = await api(`repos/${name}/actions/runs?per_page=100&page=${page}`);
    if (list.workflow_runs.length === 0) break;
    for (const run of list.workflow_runs) {
      const found = await api(`repos/${name}/actions/runs/${run.id}/jobs?per_page=100&filter=all`);
      for (const job of found.jobs) {
        if (!job.labels.some((label) => metered.has(label)) || !job.started_at || !job.completed_at) continue;
        const took = seconds(job.started_at, job.completed_at);
        if (took > 0) {
          total += Math.ceil(took / 60);
          jobs++;
        }
      }
    }
  }
  console.log(JSON.stringify({ repository: name, metered_jobs: jobs, billed_minutes: total }));
}

async function cleanup(name) {
  const branches = new Set(loadRaw(name).map((record) => record.branch));
  for (const branch of branches) await dropBranch(branch);
  log(`dropped ${branches.size} branch(es)`);
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === "one") await one(rest);
  else if (command === "series") await series(rest[0], rest.slice(1));
  else if (command === "summarize") summarize(ROOT, rest[0], loadRaw(rest[0]), PROJECTS, CONFIG);
  else if (command === "minutes") await minutes();
  else if (command === "cleanup") await cleanup(rest[0]);
  else {
    console.error("usage: bench.mjs one|series|summarize|minutes|cleanup (see the top of this file)");
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

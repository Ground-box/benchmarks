// Turns results/raw/*.json into results/summary.json and results/summary.md.
// Only runs that succeeded are counted in the statistics; the others are counted
// separately and stay in results/raw.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

function stats(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return { n: 0, median: null, min: null, max: null };
  const mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { n: sorted.length, median, min: sorted[0], max: sorted.at(-1) };
}

const ratio = (baseline, candidate) => (baseline && candidate ? Math.round((baseline / candidate) * 100) / 100 : null);

function clock(value) {
  if (value === null || value === undefined) return "n/a";
  const whole = Math.round(value);
  return whole >= 60 ? `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, "0")}s` : `${whole}s`;
}

const cell = (s) => (s.n ? `${clock(s.median)} (${clock(s.min)} to ${clock(s.max)}, n=${s.n})` : "no successful run");

export function summarize(root, series, records, projects, config) {
  if (records.length === 0) throw new Error(`no raw results for series ${series}`);
  const runnerIds = config.runners.map((runner) => runner.id).filter((id) => records.some((record) => record.runner_id === id));
  const machines = {};
  for (const id of runnerIds) {
    const seen = records.filter((record) => record.runner_id === id && record.machine?.nproc);
    const pick = (key) => [...new Set(seen.map((record) => record.machine[key]))].filter((value) => value !== undefined);
    machines[id] = {
      label: config.runners.find((runner) => runner.id === id).label,
      provider: config.runners.find((runner) => runner.id === id).provider,
      vcpus: pick("nproc"),
      memory_gb: pick("mem_gb"),
      cpu_models: pick("cpu"),
    };
  }

  const out = {
    series,
    generated_at: new Date().toISOString(),
    first_run_at: records.map((record) => record.dispatched_at).sort()[0],
    last_run_at: records.map((record) => record.run?.updated_at ?? record.dispatched_at).sort().at(-1),
    harness_commits: [...new Set(records.map((record) => record.harness_commit))],
    definitions: {
      job_s: "job started_at to completed_at from the GitHub API: the whole job, with setup and post steps",
      queue_s: "job created_at to started_at from the GitHub API: the wait for a runner",
      to_first_step_s: "job created_at to the first step's started_at",
      ratio: "baseline median job time divided by candidate median job time; above 1 means the candidate was faster",
      cold: "no Actions cache entry exists for the branch the run is on",
      warm: "run on a branch whose cache was filled by one earlier run of the same job",
    },
    runners: machines,
    runs: { total: records.length, ok: records.filter((record) => record.status === "ok").length, not_ok: records.filter((record) => record.status !== "ok").length },
    projects: [],
  };

  for (const project of projects) {
    const entry = { id: project.id, name: project.name, repo: project.repo, commit: project.commit, shape: project.shape, runners: {}, comparisons: [], not_ok: [] };
    for (const id of runnerIds) {
      const mine = records.filter((record) => record.project === project.id && record.runner_id === id);
      const ok = mine.filter((record) => record.status === "ok");
      const row = { queue_s: stats(ok.map((record) => record.derived.queue_s)), to_first_step_s: stats(ok.map((record) => record.derived.to_first_step_s)) };
      for (const kind of ["cold", "warm"]) {
        const runs = ok.filter((record) => record.kind === kind);
        const stepNames = [...new Set(runs.flatMap((record) => record.derived.steps.map((step) => step.name)))];
        row[kind] = {
          job_s: stats(runs.map((record) => record.derived.job_s)),
          steps: Object.fromEntries(
            stepNames.map((name) => [name, stats(runs.map((record) => record.derived.steps.find((step) => step.name === name)?.seconds))]),
          ),
          cache_restored_runs: runs.filter((record) => record.cache?.restored || record.cache?.docker_cached_layers > 0).length,
        };
      }
      entry.runners[id] = row;
      for (const record of mine.filter((r) => r.status !== "ok")) {
        entry.not_ok.push({ runner: id, kind: record.kind, n: record.n, attempt: record.attempt, status: record.status, url: record.run?.html_url ?? null, error: record.error ?? null });
      }
    }
    for (const pair of config.pairs) {
      const baseline = entry.runners[pair.baseline];
      const candidate = entry.runners[pair.candidate];
      if (!baseline || !candidate) continue;
      entry.comparisons.push({
        baseline: pair.baseline,
        candidate: pair.candidate,
        cold_ratio: ratio(baseline.cold.job_s.median, candidate.cold.job_s.median),
        warm_ratio: ratio(baseline.warm.job_s.median, candidate.warm.job_s.median),
      });
    }
    if (Object.values(entry.runners).some((row) => row.cold.job_s.n || row.warm.job_s.n) || entry.not_ok.length) out.projects.push(entry);
  }

  writeFileSync(join(root, "results", "summary.json"), JSON.stringify(out, null, 2) + "\n");

  const md = [];
  md.push(`# Results: series ${series}`, "");
  md.push(`Runs from ${out.first_run_at} to ${out.last_run_at} (UTC). ${out.runs.total} runs, ${out.runs.ok} succeeded, ${out.runs.not_ok} did not.`);
  md.push("Each cell is the median job time, then the fastest and slowest run and the number of successful runs. Times are the job's `started_at` to `completed_at` from the GitHub API.", "");
  md.push("## Runners", "", "| Runner | Label | vCPUs seen | Memory seen (GB) | CPU model seen |", "| --- | --- | --- | --- | --- |");
  for (const id of runnerIds) {
    const m = machines[id];
    md.push(`| ${m.provider} | \`${m.label}\` | ${m.vcpus.join(", ") || "n/a"} | ${m.memory_gb.join(", ") || "n/a"} | ${m.cpu_models.join("; ") || "n/a"} |`);
  }
  md.push("");

  for (const pair of config.pairs) {
    if (!runnerIds.includes(pair.baseline) || !runnerIds.includes(pair.candidate)) continue;
    md.push(`## ${pair.candidate} against ${pair.baseline}`, "");
    md.push("Ratio is the baseline median divided by the candidate median. Above 1.00 the candidate was faster; below 1.00 it was slower.", "");
    md.push(`| Project | Cold: ${pair.baseline} | Cold: ${pair.candidate} | Cold ratio | Warm: ${pair.baseline} | Warm: ${pair.candidate} | Warm ratio |`, "| --- | --- | --- | --- | --- | --- | --- |");
    for (const entry of out.projects) {
      const b = entry.runners[pair.baseline];
      const c = entry.runners[pair.candidate];
      const cmp = entry.comparisons.find((x) => x.candidate === pair.candidate);
      md.push(
        `| ${entry.name} | ${clock(b.cold.job_s.median)} (n=${b.cold.job_s.n}) | ${clock(c.cold.job_s.median)} (n=${c.cold.job_s.n}) | ${cmp.cold_ratio?.toFixed(2) ?? "n/a"} | ${clock(b.warm.job_s.median)} (n=${b.warm.job_s.n}) | ${clock(c.warm.job_s.median)} (n=${c.warm.job_s.n}) | ${cmp.warm_ratio?.toFixed(2) ?? "n/a"} |`,
      );
    }
    md.push("");
  }

  md.push("## Each project", "");
  for (const entry of out.projects) {
    md.push(`### ${entry.name}`, "", `\`${entry.repo}\` at \`${entry.commit}\`. ${entry.shape}.`, "");
    md.push("| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |", "| --- | --- | --- | --- |");
    for (const id of runnerIds) {
      const row = entry.runners[id];
      md.push(`| \`${id}\` | ${cell(row.cold.job_s)} | ${cell(row.warm.job_s)} | ${cell(row.queue_s)} |`);
    }
    for (const cmp of entry.comparisons) {
      md.push("", `Ratio, ${cmp.baseline} over ${cmp.candidate}: cold ${cmp.cold_ratio?.toFixed(2) ?? "n/a"}, warm ${cmp.warm_ratio?.toFixed(2) ?? "n/a"}.`);
    }
    if (entry.not_ok.length) {
      md.push("", "Runs that did not succeed (kept in `results/raw`, left out of the statistics):", "");
      for (const bad of entry.not_ok) md.push(`- \`${bad.runner}\` ${bad.kind}-${bad.n}, attempt ${bad.attempt}: ${bad.status}${bad.error ? ` (${bad.error})` : ""}`);
    }
    md.push("");
  }
  writeFileSync(join(root, "results", "summary.md"), md.join("\n"));
  console.log(`wrote results/summary.json and results/summary.md (${out.runs.total} runs)`);
}

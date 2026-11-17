# CI runner benchmark

The same GitHub Actions jobs, run on Groundbox runners and on GitHub-hosted runners, and timed from the GitHub API. This repository holds the workflows, the harness that starts and records the runs, and every raw result.

- Results: [results/summary.md](results/summary.md) and [results/summary.json](results/summary.json)
- Raw data, one file per run: [results/raw](results/raw)

Groundbox ran this benchmark on its own service. Read the method, and rerun it if you doubt a number.

## What is compared

| Runner | `runs-on` label | Size, as the jobs saw it |
| --- | --- | --- |
| GitHub-hosted, standard Linux runner for private repositories | `ubuntu-latest` | 2 vCPUs, 7.7 GB of memory |
| Groundbox | `groundbox-2vcpu` | 2 vCPUs, 7.8 GB of memory |
| Groundbox | `groundbox-4vcpu` | 4 vCPUs, 15.6 GB of memory |

The comparison is `groundbox-2vcpu` against `ubuntu-latest`: 2 vCPUs against 2 vCPUs. `groundbox-4vcpu` is reported beside them and compared with nothing, because the GitHub plan this repository is on has no 4 vCPU GitHub-hosted runner to put next to it.

The first step of every job prints the vCPU count, memory and CPU model, and the harness reads them back from the job log. GitHub gave us several CPU models over the series; they are listed in the results. Groundbox jobs run in a virtual machine made for the job on a Ryzen 9 9950X3D host, and the guest reports its CPU as "AMD EPYC".

## The ten projects

Each workflow checks the project out at a fixed commit. None of their code is copied into this repository.

| Project | Commit | Job | Cache, set up the same way on every runner |
| --- | --- | --- | --- |
| [Vue core](https://github.com/vuejs/core) (MIT) | [`cbd95955a5`](https://github.com/vuejs/core/commit/cbd95955a5362b44060908f6e28ad447c3031b8a) | TypeScript monorepo (pnpm): install, build every package, unit tests | actions/setup-node, cache: pnpm |
| [react.dev](https://github.com/reactjs/react.dev) (CC-BY-4.0) | [`46a54e0592`](https://github.com/reactjs/react.dev/commit/46a54e0592729712b7640308b53268e84fdc7c9f) | Next.js site: install and production build | actions/setup-node, cache: yarn; actions/cache for .next/cache |
| [pytest](https://github.com/pytest-dev/pytest) (MIT) | [`50234b4e67`](https://github.com/pytest-dev/pytest/commit/50234b4e670064c42a4c29cb6258115a2079ba4c) | Python: pip install, its own test suite under pytest-xdist | actions/setup-python, cache: pip |
| [ripgrep](https://github.com/BurntSushi/ripgrep) (Unlicense) | [`178cc027e2`](https://github.com/BurntSushi/ripgrep/commit/178cc027e283fd965cb72d0a7395b219eada170c) | Rust: release build, then the workspace tests | Swatinem/rust-cache |
| [GitHub CLI](https://github.com/cli/cli) (MIT) | [`0536d5e528`](https://github.com/cli/cli/commit/0536d5e5288458c696ccbeac0e68d87128300069) | Go: module download, unit tests, build | actions/setup-go (its built-in cache) |
| [Spring PetClinic](https://github.com/spring-projects/spring-petclinic) (Apache-2.0) | [`500158f732`](https://github.com/spring-projects/spring-petclinic/commit/500158f732419217507c7656904b8e6aa1bcc0d6) | Java 17 and Maven: ./mvnw verify, with tests that start database containers | actions/setup-java, cache: maven |
| [Example Voting App](https://github.com/dockersamples/example-voting-app) (Apache-2.0) | [`63e9150ca1`](https://github.com/dockersamples/example-voting-app/commit/63e9150ca17af4ed05880d4245e486481f73fcb4) | Docker: three image builds (Python, Node, .NET multi-stage) | docker/build-push-action, cache-from and cache-to type=gha |
| [{fmt}](https://github.com/fmtlib/fmt) (MIT) | [`14ac0d5a9d`](https://github.com/fmtlib/fmt/commit/14ac0d5a9d40aef14f50954069c1e10971abb0b2) | C++: CMake configure, build, ctest | hendrikmuhs/ccache-action |
| [Jekyll](https://github.com/jekyll/jekyll) (MIT) | [`97c3bdc822`](https://github.com/jekyll/jekyll/commit/97c3bdc822df9d5bea4c269b29a28de5a5e29d70) | Ruby: bundle install, Minitest suite, generate and build a site | ruby/setup-ruby, bundler-cache: true |
| [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT) | [`c0a0ca348f`](https://github.com/excalidraw/excalidraw/commit/c0a0ca348faa273c768de839a22df113f997c095) | Web app (yarn): install, format check, lint, typecheck, tests | actions/setup-node, cache: yarn |

The steps are each project's own documented commands or its own CI job, run with stock actions (`actions/checkout`, the `setup-*` actions, `actions/cache`, `docker/build-push-action` and the like). There are no Groundbox actions and no steps that depend on the runner. The only thing that changes between runners is the `runs-on` label, which is a workflow input. The files are in [.github/workflows](.github/workflows).

Actions are referenced by major version tag, so a rerun months later may get a newer release of an action.

## Method

**One job at a time per runner.** The harness starts a job on a runner only after the last job on that runner has finished. The three runners advance side by side, so at most two Groundbox jobs run at once.

**Rounds.** A round runs each project once. Two runs of the same project on the same runner are a whole round apart, not back to back.

**Cold runs.** GitHub Actions caches are scoped to a branch: a job can restore caches saved from its own branch or from the default branch. The default branch of this repository never runs a benchmark job, so it holds no caches. Each cold run goes on a branch made for that run, where no cache exists. There are 3 cold runs per project and runner.

**Warm runs.** The third cold run is the first run on a branch that is then kept, and it fills the cache. The 5 warm runs that follow use that branch, so they restore what the cold run saved.

**What "cold" does not cover.** A cold run has no Actions cache. It does not have an empty machine. GitHub-hosted runners come with tools preinstalled and sit close to GitHub's own services. Groundbox runners also come with tools preinstalled, and Groundbox keeps mirrors of public package registries (npm, PyPI, crates.io, apt, Docker Hub and Go modules) next to its runners, which every job uses without any change to the workflow. Those mirrors were not emptied before cold runs, and a workflow cannot empty them. They are part of what each service gives a job, so they are part of what is measured.

**What is recorded.** After a run finishes, the harness reads the run, its job and the job's steps from the GitHub REST API and writes them to `results/raw`. From those timestamps:

- wait for a runner: the job's `created_at` to its `started_at`
- job time: the job's `started_at` to its `completed_at`, which includes setup and the post steps that save caches
- step time: each step's `started_at` to its `completed_at`

GitHub reports these to the second. Nothing is timed inside the job.

**What is reported.** For each project and runner: the median, the fastest run, the slowest run and the number of runs, cold and warm separately. Never one best run. The ratio is the GitHub-hosted median divided by the Groundbox median: above 1 Groundbox was faster, below 1 it was slower.

**Failures.** A run that fails or is cancelled is kept in `results/raw` with its status and left out of the statistics. The harness tries a failed slot once more and keeps both attempts. `results/summary.md` lists every run that did not succeed.

## Limits

- **One afternoon.** Series `2026-11-16` ran from 22:05 UTC on 16 November 2026 to 02:40 UTC on 17 November. GitHub-hosted runners vary with the time of day, the region and the machine you are given: over this series GitHub gave the jobs six different CPU models (listed in the results). A rerun on another day will differ.
- **Small samples.** Three cold runs and five warm runs per project and runner. The medians are stable enough to show a 2× gap; they are not precise to the second.
- **One Groundbox machine.** All Groundbox jobs ran on one host, which was also serving other customers' jobs at the time. That is the normal state of the service, not an idle machine.
- **2 vCPU only for the comparison.** This repository's GitHub plan has no 4 vCPU GitHub-hosted runner, so `groundbox-4vcpu` is measured and reported with nothing beside it.
- **Wait for a runner.** On Groundbox it depends on how many idle VMs of that size are waiting. In this series `groundbox-4vcpu` waited a median of 1 s and `groundbox-2vcpu` a median of 6 s; GitHub's `ubuntu-latest` waited a median of 2 s.
- **{fmt}, warm, on Groundbox.** `hendrikmuhs/ccache-action` restores with the key `ccache-` and no `restore-keys`, relying on the cache service to match that key as a prefix, as GitHub's does. Groundbox's Actions cache matched the primary key only exactly, so none of the ten warm runs on Groundbox restored the compiler cache and each rebuilt from scratch. The numbers are reported as measured: on warm runs Groundbox was slower than GitHub on this project. The cache was fixed to match the primary key as a prefix too, and {fmt} was measured again on 2026-11-17 (series `2026-11-17-fmt`, `results/summary-2026-11-17-fmt.md`): warm 7 s on Groundbox against 29 s on GitHub, cold 1m 07s against 3m 18s. groundbox.dev/benchmark shows the re-measured {fmt} numbers.
- **Failures.** 243 runs, 240 succeeded. The three that did not were test failures inside the projects' own suites, not runner errors: react.dev's build on GitHub-hosted (a `fetch failed` while prerendering one page), one pytest test timing out on `groundbox-4vcpu` (`test_pdb_unittest_postmortem`) and one Excalidraw clipboard test on GitHub-hosted. Each slot was rerun once and passed; the failed runs are in `results/raw` and are left out of the statistics.
- **Not every cache is equal.** Each project uses the cache its own ecosystem's stock action offers. Some cache more than others (Docker layers save almost everything; pip saves only downloads), which is why warm gains differ by project.

## How to rerun this

You need Node 20 or later, the GitHub CLI (`gh`) logged in, and a GitHub repository in an organisation that has the runners you want to compare.

1. Put a copy of this repository in your organisation. Keep `main` as the default branch and never run these workflows on `main`.
2. Edit `runners.json`: one entry per `runs-on` label, and the pairs to compare. Set `billed_minutes` to true for runners whose minutes GitHub bills you for.
3. Try one job: `node harness/bench.mjs one ripgrep github-2vcpu`. It prints the timings and writes nothing.
4. Run a series: `node harness/bench.mjs series my-series --max-billed-minutes 600`. It takes several hours, because jobs run one at a time per runner. You can stop it and start it again with the same name; finished runs are not repeated.
5. Summarise: `node harness/bench.mjs summarize my-series` writes `results/summary.json` and `results/summary.md`.
6. Tidy up: `node harness/bench.mjs cleanup my-series` deletes the series' branches and their caches.

`node harness/bench.mjs minutes` adds up the billed minutes of every metered job in the repository, each job rounded up to a whole minute.

To move a project to a newer commit, change it in `projects.json` and in the project's workflow file. To add a project, add a workflow with the same two inputs (`runner` and `tag`) and the same `run-name`, and list it in `projects.json`.

If your numbers differ from ours, open an issue and attach your `results/raw` files.

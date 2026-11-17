# Results: series 2026-11-16

Runs from 2026-11-16T22:05:06.771Z to 2026-11-17T02:39:53Z (UTC). 243 runs, 240 succeeded, 3 did not.
Each cell is the median job time, then the fastest and slowest run and the number of successful runs. Times are the job's `started_at` to `completed_at` from the GitHub API.

## Runners

| Runner | Label | vCPUs seen | Memory seen (GB) | CPU model seen |
| --- | --- | --- | --- | --- |
| GitHub-hosted | `ubuntu-latest` | 2 | 7.7, 7.6 | AMD EPYC 9V74 80-Core Processor; AMD EPYC 7763 64-Core Processor; Intel(R) Xeon(R) 6975P-C; INTEL(R) XEON(R) PLATINUM 8573C; AMD EPYC 9V45 96-Core Processor; Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz |
| Groundbox | `groundbox-2vcpu` | 2 | 7.8 | AMD EPYC |
| Groundbox | `groundbox-4vcpu` | 4 | 15.6 | AMD EPYC |

## groundbox-2vcpu against github-2vcpu

Ratio is the baseline median divided by the candidate median. Above 1.00 the candidate was faster; below 1.00 it was slower.

| Project | Cold: github-2vcpu | Cold: groundbox-2vcpu | Cold ratio | Warm: github-2vcpu | Warm: groundbox-2vcpu | Warm ratio |
| --- | --- | --- | --- | --- | --- | --- |
| Vue core | 2m 38s (n=3) | 1m 08s (n=3) | 2.32 | 2m 31s (n=5) | 1m 03s (n=5) | 2.40 |
| react.dev | 3m 32s (n=3) | 1m 24s (n=3) | 2.52 | 2m 53s (n=5) | 58s (n=5) | 2.98 |
| pytest | 3m 27s (n=3) | 1m 40s (n=3) | 2.07 | 3m 31s (n=5) | 1m 31s (n=5) | 2.32 |
| ripgrep | 1m 35s (n=3) | 45s (n=3) | 2.11 | 58s (n=5) | 23s (n=5) | 2.52 |
| GitHub CLI | 4m 59s (n=3) | 2m 30s (n=3) | 1.99 | 2m 08s (n=5) | 52s (n=5) | 2.46 |
| Spring PetClinic | 2m 17s (n=3) | 1m 05s (n=3) | 2.11 | 2m 00s (n=5) | 48s (n=5) | 2.50 |
| Example Voting App | 1m 37s (n=3) | 36s (n=3) | 2.69 | 31s (n=5) | 11s (n=5) | 2.82 |
| {fmt} | 3m 29s (n=3) | 1m 17s (n=3) | 2.71 | 28s (n=5) | 1m 04s (n=5) | 0.44 |
| Jekyll | 2m 14s (n=3) | 1m 11s (n=3) | 1.89 | 1m 29s (n=5) | 50s (n=5) | 1.78 |
| Excalidraw | 9m 53s (n=3) | 5m 57s (n=3) | 1.66 | 10m 52s (n=5) | 5m 09s (n=5) | 2.11 |

{fmt}'s warm row above is from before a cache fix (see the README's limits). Measured again on 2026-11-17 after the fix: warm 7 s on Groundbox against 29 s on GitHub (n=5 each), cold 1m 07s against 3m 18s (n=3 each). See `summary-2026-11-17-fmt.md`.

## Each project

### Vue core

`vuejs/core` at `cbd95955a5362b44060908f6e28ad447c3031b8a`. TypeScript monorepo (pnpm): install, build every package, unit tests.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 2m 38s (2m 06s to 2m 40s, n=3) | 2m 31s (1m 53s to 2m 39s, n=5) | 2s (1s to 4s, n=8) |
| `groundbox-2vcpu` | 1m 08s (1m 08s to 1m 38s, n=3) | 1m 03s (1m 01s to 1m 07s, n=5) | 6s (5s to 6s, n=8) |
| `groundbox-4vcpu` | 41s (39s to 48s, n=3) | 38s (37s to 42s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.32, warm 2.40.

### react.dev

`reactjs/react.dev` at `46a54e0592729712b7640308b53268e84fdc7c9f`. Next.js site: install and production build.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 3m 32s (3m 29s to 5m 31s, n=3) | 2m 53s (2m 44s to 3m 10s, n=5) | 2s (1s to 3s, n=8) |
| `groundbox-2vcpu` | 1m 24s (1m 24s to 1m 40s, n=3) | 58s (57s to 1m 04s, n=5) | 6s (5s to 14s, n=8) |
| `groundbox-4vcpu` | 1m 13s (1m 05s to 1m 23s, n=3) | 47s (47s to 52s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.52, warm 2.98.

Runs that did not succeed (kept in `results/raw`, left out of the statistics):

- `github-2vcpu` cold-1, attempt 1: failure

### pytest

`pytest-dev/pytest` at `50234b4e670064c42a4c29cb6258115a2079ba4c`. Python: pip install, its own test suite under pytest-xdist.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 3m 27s (2m 37s to 3m 57s, n=3) | 3m 31s (2m 42s to 3m 58s, n=5) | 2s (1s to 2s, n=8) |
| `groundbox-2vcpu` | 1m 40s (1m 37s to 1m 52s, n=3) | 1m 31s (1m 30s to 1m 41s, n=5) | 7s (4s to 8s, n=8) |
| `groundbox-4vcpu` | 1m 17s (1m 08s to 1m 28s, n=3) | 1m 08s (57s to 1m 11s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.07, warm 2.32.

Runs that did not succeed (kept in `results/raw`, left out of the statistics):

- `groundbox-4vcpu` warm-2, attempt 1: failure

### ripgrep

`BurntSushi/ripgrep` at `178cc027e283fd965cb72d0a7395b219eada170c`. Rust: release build, then the workspace tests.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 1m 35s (1m 20s to 1m 58s, n=3) | 58s (47s to 1m 06s, n=5) | 2s (1s to 2s, n=8) |
| `groundbox-2vcpu` | 45s (44s to 45s, n=3) | 23s (22s to 28s, n=5) | 6s (4s to 6s, n=8) |
| `groundbox-4vcpu` | 26s (26s to 31s, n=3) | 16s (16s to 19s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.11, warm 2.52.

### GitHub CLI

`cli/cli` at `0536d5e5288458c696ccbeac0e68d87128300069`. Go: module download, unit tests, build.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 4m 59s (4m 51s to 7m 05s, n=3) | 2m 08s (2m 03s to 2m 15s, n=5) | 2s (1s to 2s, n=8) |
| `groundbox-2vcpu` | 2m 30s (2m 25s to 3m 06s, n=3) | 52s (46s to 55s, n=5) | 5s (5s to 8s, n=8) |
| `groundbox-4vcpu` | 1m 24s (1m 23s to 1m 49s, n=3) | 30s (30s to 34s, n=5) | 1s (1s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 1.99, warm 2.46.

### Spring PetClinic

`spring-projects/spring-petclinic` at `500158f732419217507c7656904b8e6aa1bcc0d6`. Java 17 and Maven: ./mvnw verify, with tests that start database containers.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 2m 17s (2m 17s to 2m 22s, n=3) | 2m 00s (1m 45s to 2m 07s, n=5) | 2s (1s to 2s, n=8) |
| `groundbox-2vcpu` | 1m 05s (1m 05s to 1m 21s, n=3) | 48s (46s to 50s, n=5) | 6s (4s to 10s, n=8) |
| `groundbox-4vcpu` | 1m 07s (59s to 1m 11s, n=3) | 39s (39s to 40s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.11, warm 2.50.

### Example Voting App

`dockersamples/example-voting-app` at `63e9150ca17af4ed05880d4245e486481f73fcb4`. Docker: three image builds (Python, Node, .NET multi-stage).

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 1m 37s (1m 32s to 1m 58s, n=3) | 31s (23s to 34s, n=5) | 1s (1s to 2s, n=8) |
| `groundbox-2vcpu` | 36s (34s to 39s, n=3) | 11s (9s to 12s, n=5) | 6s (4s to 16s, n=8) |
| `groundbox-4vcpu` | 30s (30s to 35s, n=3) | 10s (10s to 10s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.69, warm 2.82.

### {fmt}

`fmtlib/fmt` at `14ac0d5a9d40aef14f50954069c1e10971abb0b2`. C++: CMake configure, build, ctest.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 3m 29s (2m 40s to 3m 37s, n=3) | 28s (21s to 31s, n=5) | 2s (1s to 2s, n=8) |
| `groundbox-2vcpu` | 1m 17s (1m 11s to 1m 23s, n=3) | 1m 04s (1m 03s to 1m 13s, n=5) | 5s (5s to 19s, n=8) |
| `groundbox-4vcpu` | 43s (43s to 45s, n=3) | 43s (42s to 48s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.71, warm 0.44.

### Jekyll

`jekyll/jekyll` at `97c3bdc822df9d5bea4c269b29a28de5a5e29d70`. Ruby: bundle install, Minitest suite, generate and build a site.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 2m 14s (1m 37s to 2m 19s, n=3) | 1m 29s (1m 07s to 1m 34s, n=5) | 1s (1s to 3s, n=8) |
| `groundbox-2vcpu` | 1m 11s (1m 00s to 1m 16s, n=3) | 50s (44s to 1m 06s, n=5) | 6s (4s to 7s, n=8) |
| `groundbox-4vcpu` | 55s (55s to 1m 12s, n=3) | 50s (46s to 53s, n=5) | 0s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 1.89, warm 1.78.

### Excalidraw

`excalidraw/excalidraw` at `c0a0ca348faa273c768de839a22df113f997c095`. Web app (yarn): install, format check, lint, typecheck, tests.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 9m 53s (9m 33s to 10m 00s, n=3) | 10m 52s (8m 41s to 11m 01s, n=5) | 2s (2s to 5s, n=8) |
| `groundbox-2vcpu` | 5m 57s (5m 53s to 6m 12s, n=3) | 5m 09s (4m 52s to 5m 15s, n=5) | 5s (4s to 6s, n=8) |
| `groundbox-4vcpu` | 3m 01s (2m 47s to 3m 02s, n=3) | 2m 27s (2m 23s to 2m 40s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 1.66, warm 2.11.

Runs that did not succeed (kept in `results/raw`, left out of the statistics):

- `github-2vcpu` warm-3, attempt 1: failure

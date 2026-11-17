# Results: series 2026-11-17-fmt

Runs from 2026-11-17T04:28:21.383Z to 2026-11-17T04:42:41Z (UTC). 24 runs, 24 succeeded, 0 did not.
Each cell is the median job time, then the fastest and slowest run and the number of successful runs. Times are the job's `started_at` to `completed_at` from the GitHub API.

## Runners

| Runner | Label | vCPUs seen | Memory seen (GB) | CPU model seen |
| --- | --- | --- | --- | --- |
| GitHub-hosted | `ubuntu-latest` | 2 | 7.7 | INTEL(R) XEON(R) PLATINUM 8573C; AMD EPYC 9V74 80-Core Processor; AMD EPYC 7763 64-Core Processor; Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz |
| Groundbox | `groundbox-2vcpu` | 2 | 7.8 | AMD EPYC |
| Groundbox | `groundbox-4vcpu` | 4 | 15.6 | AMD EPYC |

## groundbox-2vcpu against github-2vcpu

Ratio is the baseline median divided by the candidate median. Above 1.00 the candidate was faster; below 1.00 it was slower.

| Project | Cold: github-2vcpu | Cold: groundbox-2vcpu | Cold ratio | Warm: github-2vcpu | Warm: groundbox-2vcpu | Warm ratio |
| --- | --- | --- | --- | --- | --- | --- |
| {fmt} | 3m 18s (n=3) | 1m 07s (n=3) | 2.96 | 29s (n=5) | 7s (n=5) | 4.14 |

## Each project

### {fmt}

`fmtlib/fmt` at `14ac0d5a9d40aef14f50954069c1e10971abb0b2`. C++: CMake configure, build, ctest.

| Runner | Cold job time | Warm job time | Wait for a runner (all runs) |
| --- | --- | --- | --- |
| `github-2vcpu` | 3m 18s (2m 40s to 3m 49s, n=3) | 29s (21s to 50s, n=5) | 1s (1s to 2s, n=8) |
| `groundbox-2vcpu` | 1m 07s (1m 03s to 1m 07s, n=3) | 7s (7s to 8s, n=5) | 5s (4s to 5s, n=8) |
| `groundbox-4vcpu` | 43s (42s to 43s, n=3) | 7s (7s to 8s, n=5) | 1s (0s to 1s, n=8) |

Ratio, github-2vcpu over groundbox-2vcpu: cold 2.96, warm 4.14.

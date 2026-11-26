# demo project

Sample machine project (config.json, tags.json, program.json) used by tests and the simulator. Filled in phase P1.

| File | Status |
|---|---|
| `tags.json` | step 15 — 20 tags, every kind (2 axes, 4 DI, 3 DO, 1 AI, 1 AO, points, registers, timer, counter, alarm, recipe, cylinder UDT), sorted by name |
| `config.json` | step 35 — the runtime: SimCard, 1 ms cycle, spin_us 800; step 36: `sim.demo_alarms` |
| `program.json` | step 37 — the demo flow S1_Main: clamp → wait closed → move X to Pick → 100 ms → release → wait open → move X to Place → End (cycles by itself on the SimCard, ~2 s) |
| `program.rt.json` | step 37 — the demo compiled by the studio (`npm run compile -- ../projects/demo`, CRC 20D80EEF); spm_rt loads it at start-up; every Download from the studio rewrites it |

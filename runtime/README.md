# runtime — `spm_rt` (C real-time runtime)

The machine program. Runs on its own (Windows service / Linux process), owns all hardware access, and serves the studio on `ws://127.0.0.1:7600`.

Current state: **skeleton (phase P0)** — builds and prints its version.

```bash
cmake -S runtime -B runtime/build
cmake --build runtime/build
./runtime/build/spm_rt --version
```

Planned layers (unity build, see mind_map → Software implementation → 11c):
`base/` (arena, strings, time) → `os/` (threads, files, RT timer) → `data/` (JSON load, tag DB, program) → `feat/` (flow, ops, alarms, io, ws, log) → `drv/` (card_sim, card_gts, card_adv, card_delta).

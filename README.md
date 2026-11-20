# SPM Studio

Engineering and operator studio for SPM (special purpose machine) automation: flowchart programs, tag database, motion, alarms, recipes and production data. The full design lives in the `mind_map` repo → `mind_map.drawio` → **Software implementation** page.

```
SPM_Studio/
├─ studio/      Electron app — TypeScript + React screens (N01–N10)
├─ runtime/     spm_rt — C real-time runtime (owns all hardware)
├─ schemas/     JSON contracts shared by studio and runtime
├─ projects/    machine projects (demo used by tests and simulator)
└─ docs/adr/    architecture decision records
```

## Quick start (studio)

Needs Node.js 22 LTS and Git.

```bash
cd studio
npm install
npm run mock-runtime     # terminal 1: fake runtime on ws://127.0.0.1:7600
npm run dev              # terminal 2: studio with hot reload
```

The status bar turns green when the studio is connected; N01 Overview shows live values, events and Start / Stop commands. Stop the mock runtime and the studio shows *RUNTIME OFFLINE*, then reconnects by itself when it comes back.

| Command (in `studio/`) | What it does |
|---|---|
| `npm run dev` | studio with hot reload (screens) and auto-restart (main) |
| `npm run check` | typecheck + lint + tests + build (same as CI) |
| `npm run mock-runtime` | stand-in for `spm_rt` until phase P3 |
| `npm run dist:win` | Windows installer in `studio/dist/` |

## Develop in the browser (GitHub Codespaces)

Code → Codespaces → *New with options* (4-core). Everything is installed automatically; the Electron window opens in a browser tab on port 6080 (password `spm`). Full guide: [docs/codespaces.md](docs/codespaces.md).

## Runtime

```bash
cmake -S runtime -B runtime/build && cmake --build runtime/build
```

## Architecture rules (short)

1. Only `spm_rt` touches hardware. Studio close / crash never stops the machine.
2. Screens use only `window.spm` (preload API) — never Electron or Node directly (lint enforces it).
3. Every frame from the runtime is validated (`studio/src/shared/protocol.ts`) before use.
4. IPC channel names and payload types live only in `studio/src/shared/ipc.ts`.
5. Schema change = version bump + both sides in the same commit.

## Status

Phase **P0** (tools and repository) — done: secure Electron shell, runtime bridge with reconnect and request ids, live store, N01 Overview, placeholders N02–N10, mock runtime, C runtime skeleton, CI.
Next: **P1** contracts (config / tags / program schemas, demo project, generated types).

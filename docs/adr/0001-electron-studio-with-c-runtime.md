# ADR 0001 — Electron studio + separate C runtime

- Status: accepted
- Date: 2026-11-20

## Context
The platform needs a rich engineering UI (flowchart editor, tag tables, dashboards) and deterministic machine control on one industrial PC.

## Decision
- Screens: TypeScript + React inside Electron (`studio/`).
- Machine: C runtime `spm_rt` as a separate process (`runtime/`), the only program touching hardware.
- Link: local WebSocket `ws://127.0.0.1:7600`, JSON text frames + binary trace frames (`schemas/message.schema.json`).
- Screens never depend on Electron directly (only the `window.spm` preload API), so the host can later move to WebView2 / Tauri.

## Consequences
- Studio crash or close never stops the machine; safety stays hard-wired.
- Two languages and toolchains; kept in step by shared schemas (and generated code from P1).
- Electron weaknesses and mitigations: mind_map → Software implementation → section 12.

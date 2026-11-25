# schemas

Contracts shared by the studio (TypeScript) and the runtime (C). Change a schema → bump its version (`spm.message/1` → `/2`) and update both sides in the same commit.

| File | Status |
|---|---|
| `message.schema.json` | P0 — WebSocket messages (mirrored in `studio/src/shared/protocol.ts`) |
| `tags.schema.json` | P1 step 15 — tag table `spm.tags/1` (one rule block per kind; checked by `studio/src/shared/tags-schema.ts`) |
| `program.schema.json` | P1 step 27 — editor flowcharts `spm.program/1` (flows per station; checked in `studio/src/main/project/store.ts`) |
| `rt.schema.json` | P1 step 29 — compiled step table `spm.rt/1` (what the C runtime loads; made by `studio/src/main/compiler/compile.ts`) |
| `config` schema | P1 |

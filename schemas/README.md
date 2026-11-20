# schemas

Contracts shared by the studio (TypeScript) and the runtime (C). Change a schema → bump its version (`spm.message/1` → `/2`) and update both sides in the same commit.

| File | Status |
|---|---|
| `message.schema.json` | P0 — WebSocket messages (mirrored in `studio/src/shared/protocol.ts`) |
| `config`, `tags`, `program`, `rt` schemas | P1 |

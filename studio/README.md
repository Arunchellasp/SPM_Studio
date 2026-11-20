# studio — SPM Studio (Electron + React)

```
src/
├─ main/                 main process (Node.js): window, security, IPC, runtime link
│  ├─ index.ts           window + security settings + IPC handlers
│  └─ runtime/bridge.ts  WebSocket client to spm_rt (reconnect, ids, heartbeat, 30 Hz publish)
├─ preload/index.ts      the only bridge: exposes window.spm (typed StudioApi)
├─ shared/               used by main, preload and renderer
│  ├─ ipc.ts             IPC channel names + payload types (single source)
│  └─ protocol.ts        runtime wire messages, validated with zod
└─ renderer/             screens (React)
   └─ src/
      ├─ app/            App + screen registry (N01–N10)
      ├─ shell/          top bar, nav rail, status bar
      ├─ features/       one folder per screen: <feature>.view.tsx, <feature>.store.ts …
      ├─ stores/live.ts  single copy of runtime status / state / events
      └─ theme/          N00 design tokens (tokens.css) + layout (app.css)
tools/mock-runtime.mjs   fake runtime for development
```

Security settings in `src/main/index.ts`: contextIsolation, sandbox, no nodeIntegration, strict CSP (`src/renderer/index.html`), no new windows, no navigation, IPC sender check, zod validation of every IPC payload, all permission requests denied.

Adding a screen: create `src/renderer/src/features/<name>/<name>.view.tsx` and add one entry to `app/screens.ts`.

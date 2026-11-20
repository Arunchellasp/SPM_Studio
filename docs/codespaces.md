# GitHub Codespaces — setup guide

Develop SPM_Studio from any browser (laptop, tablet, home PC) with nothing installed locally. The repo contains a ready dev container (`.devcontainer/`), so every Codespace starts with the same tools:

- Node.js 22, TypeScript, and the studio's npm packages (`npm ci` runs automatically)
- CMake, gcc, gdb, clangd, cppcheck (the C runtime is built automatically)
- the project's VS Code extensions (ESLint, Prettier, Error Lens, GitLens, clangd, CMake Tools, Draw.io, Vitest)
- a small Linux desktop you open in a browser tab, to see and click the real Electron window

---

## 1. One-time account settings (2 minutes)

On github.com → your profile picture → **Settings → Codespaces**:

| Setting | Recommended |
|---|---|
| Default idle timeout | **30 minutes** (stops a forgotten Codespace so it does not use your quota) |
| Default retention period | 7–14 days (unused Codespaces are deleted after this; push your work first) |
| Editor preference | *Visual Studio Code for the Web* (browser) or *Visual Studio Code* (desktop app) |
| Region | nearest to you (e.g. Southeast Asia) |

Check **Settings → Billing and plans** for the free monthly Codespaces quota of your plan and set a **spending limit** (₹0 / $0 keeps it inside the free quota).

## 2. Create the Codespace

1. Open <https://github.com/Arunchellasp/SPM_Studio>.
2. Green **Code** button → **Codespaces** tab → **⋯ → New with options…**
3. Branch: `main` · Machine type: **4-core, 16 GB** (2-core is too slow for Electron + Vite).
4. **Create codespace**.

The first start takes about 5–10 minutes: it builds the container, runs `npm ci` and builds `spm_rt`. Later starts take under a minute. Watch progress in the *Creation log*; when the terminal prompt appears, it is ready.

## 3. Daily workflow

Open two terminals (`Ctrl+Shift+5` splits the terminal).

**Terminal 1 — fake runtime**
```bash
cd studio
npm run mock-runtime
```

**Terminal 2 — the studio**
```bash
cd studio
npm run dev
```

**See the Electron window**

1. Open the **Ports** tab (next to Terminal).
2. On port **6080 — Desktop (Electron window)** click the globe icon 🌐 (*Open in Browser*).
3. In the noVNC page click **Connect**, password **`spm`**.
4. The SPM Studio window is on that desktop. Use it with mouse and keyboard like a normal PC. Code changes in screens reload instantly; changes in `src/main` restart the app.

Tip: in noVNC, open the left side menu → *Settings → Scaling mode: Remote resizing* so the desktop fills your browser tab.

**Before you stop for the day**
```bash
npm run check          # typecheck + lint + tests + build (same as CI)
git add -A
git commit -m "feat: …"
git push
```
Then stop the Codespace: github.com → **Code → Codespaces → ⋯ → Stop codespace** (or let the idle timeout do it). Stopped Codespaces keep your files; only running time uses compute quota.

## 4. Useful commands

| Task | Command |
|---|---|
| Run tests in watch mode | `cd studio && npx vitest` |
| Build the C runtime | `cmake --build runtime/build && ./runtime/build/spm_rt --version` |
| Format code | `cd studio && npm run format` |
| See what changed | `git status`, GitLens side bar |
| Open the mind map | open `mind_map.drawio` from the mind_map repo in a second Codespace or any Draw.io editor |

## 5. Open the same Codespace in desktop VS Code (optional, smoother)

1. Install **Visual Studio Code** and the **GitHub Codespaces** extension on your PC.
2. Command palette → *Codespaces: Connect to Codespace* → choose it.

Same container, same files; ports such as 6080 are forwarded to your PC, so `http://localhost:6080` opens the desktop.

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Port 6080 not in the Ports list | Ports tab → *Forward a Port* → `6080` |
| noVNC shows a black desktop, no window | the studio is not running: check Terminal 2 for errors; run `npm run dev` again |
| Status bar shows **RUNTIME OFFLINE** | start Terminal 1 (`npm run mock-runtime`) |
| Electron error about `chrome-sandbox` | `ELECTRON_DISABLE_SANDBOX=1` is set by the dev container; rebuild it: command palette → *Codespaces: Rebuild Container* |
| Blank or flickering window | GPU is off already (`SPM_DISABLE_GPU=1`); lower the noVNC quality or use desktop VS Code |
| `npm ci` failed during creation | run `cd studio && npm ci` in a terminal and read the first error |
| Codespace very slow | stop it and recreate with a 4-core (or 8-core) machine type |

## 7. What Codespaces cannot do

- **No real hardware.** Motion cards, drives and I/O are only on the machine PC. For phases P9+ use a VS Code Remote Tunnel to the machine PC and test there.
- **No Windows build.** Codespaces is Linux. Windows installers are built by GitHub Actions (CI) on a Windows runner.
- Timing numbers measured in a Codespace (cycle jitter) mean nothing for the real machine.

## 8. Security notes

- Codespaces are private to your GitHub account; forwarded ports are private by default — keep them **Private** (never *Public*).
- Never put vendor licences, passwords or customer data in the repo. Use **Settings → Codespaces → Secrets** for anything secret; they appear as environment variables in the Codespace.

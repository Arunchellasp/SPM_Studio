# runtime — `spm_rt` (C real-time runtime)

The machine program. Runs on its own (Windows service / Linux process), owns all hardware access, and serves the studio on `ws://127.0.0.1:7600` (from step 36).

**Now (step 36):** loads `config.json` + `tags.json`, opens the card (SimCard), binds the I/O, and runs the cycle every `cycle_us` (default 1 ms) at the highest priority the OS gives, with jitter statistics logged every `stats_s` seconds (step 35). It serves the studio on `ws://127.0.0.1:ws_port` with the same messages as the mock runtime: machine states and commands (PackML), modes, alarms and Ack, Download (CRC checked), state frames of the tag values (step 36). Next: flow engine (step 37) — then the downloaded program runs.

On the PC: close `start-mock-runtime.cmd`, double-click **`start-runtime.cmd`** (repo root), then start the studio as always.

```
studio ──ws──► civetweb threads: decode · answer ping / bad commands / failed CRC ──► command queue ──► RT cycle
studio ◄────── main thread (pump, every 5 ms): event ring ◄── RT cycle (answers, machine, alarms)
studio ◄────── state frames, 20 Hz, changed values only: value triple buffer ◄── RT cycle (every cycle)
```
The RT thread never waits, allocates or touches a socket. Exit code 6: the port is taken (another runtime or the mock is running).

```bash
cmake -S runtime -B runtime/build && cmake --build runtime/build
ctest --test-dir runtime/build --output-on-failure          # Unity tests
./runtime/build/spm_rt projects/demo/config.json             # Ctrl+C stops
./runtime/build/spm_rt projects/demo/config.json --seconds 3600   # the 1 h run
```

Windows `spm_rt.exe` from Linux (MinGW-w64): `cmake -S runtime -B runtime/build-win -DCMAKE_TOOLCHAIN_FILE=runtime/cmake/mingw-w64.cmake`.
On Windows itself: the same CMake commands with MSVC Build Tools or MinGW-w64.

## config.json (`spm.config/1`, next to the project's tags.json)

| key | default | meaning |
|---|---|---|
| `card` | `"sim"` | the I/O card driver (gts, adv, delta: later) |
| `cycle_us` | `1000` | the cycle, 250 … 10000 µs |
| `spin_us` | `200` | the last part of each wait is done on the clock (a timer alone wakes too late). Windows: 800 (the demo) — on the machine PC the timer woke up to 500 µs late; 200 → 31 % of cycles within 10 µs, 500 → 94 %, 800 → 97 % |
| `cpu` | `-1` | pin the RT thread to this core (-1: no) |
| `tags` / `program` / `log` | `tags.json` / `program.rt.json` / `logs/spm_rt.log` | relative to config.json |
| `ws_port` | `7600` | the studio link, 127.0.0.1 only |
| `stats_s` | `10` | a stats line every N seconds |
| `sim.cylinder_ms` | `200` | SimCard: cylinder end sensors follow the valve after N ms |
| `sim.demo_alarms` | `false` | SimCard: the mock's alarm demo — W0310 after 6 s in EXECUTE, E1202 (P1, abort) after 12 s without a program (the demo project: on) |

An unknown key is an error (a typo must not be ignored).

## Layers (unity build, Software implementation › 11c)

`src/spm_rt_all.c` includes, in order: `base/` (errors, arena, CRC) → `os/` (clock, files, atomics, mutex, RT thread for Windows and Linux) → `data/` (config.json, tags.json → TagDB, the download check `prog.c`) → `drv/` (card interface, SimCard) → `feat/` (I/O map, cycle statistics; `machine.c`: PackML, alarms, queue, ring, triple buffer; `comm.c`: messages and the WebSocket server). `spm_rt_main.c` adds `main()`; `tests/test_runtime.c` adds the Unity tests.

Third party (MIT, unchanged copies): `third_party/cjson` (cJSON 1.7.18), `third_party/unity` (Unity 2.6.0), `third_party/civetweb` (civetweb 1.16, built without TLS, CGI and file serving).

Tests: `ctest` (Unity, U-35.x and U-36.x) · `cd studio && npm run test:rt` (the built studio against the built spm_rt, UI-36.x).

/*
 * spm_rt — the SPM real-time runtime (Software implementation › 5a).
 * Step 35: load config.json + tags.json, open the card (SimCard), bind the I/O, run the cycle every
 * cycle_us with jitter statistics, log them.
 * Step 36: the studio link — WebSocket server on 127.0.0.1:ws_port with the mock runtime's messages; commands go
 * through a queue into the RT cycle, which runs the machine (PackML, alarms) and publishes the tag values.
 * Next: flow engine (step 37).
 *
 *   spm_rt [config.json] [--seconds N]     (Ctrl+C stops; outputs go to safe, the summary is logged)
 * Step 37: the flow engine — program.rt.json (loaded at start-up, or downloaded) runs in EXECUTE, one step table per flow.
 *   exit codes: 1 config · 2 tags · 3 card · 4 I/O map · 5 RT thread · 6 WebSocket port · 7 program.rt.json refused
 */
#ifdef _WIN32
#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#endif
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "spm_rt.h"
#include "spm_rt_all.c"

typedef struct Runtime {
    RtConfig cfg;
    Arena arena;
    TagDB tags;
    Card card;
    IoMap io;
    CycleStats stats;
    OsRt rt;
    uint64_t t0, last_us;
    /* step 36: the machine (RT thread) and the link to the studio */
    Machine machine;
    CmdQueue cmdq;
    EvRing events;
    ValueTriple values;
    uint64_t sec_start;
    uint32_t per_max_cur;
    volatile uint32_t per_max_1s; /* longest period in the last second → pong cycle_max_us */
} Runtime;
static Runtime g;
static FILE *g_log;

/* step 37: the flows in the stats line — cycles (END reached) since start-up, and each flow's step */
static const char *flows_note(const Machine *m)
{
    static char s[256];
    if (!m->prog) return "";
    int n = snprintf(s, sizeof s, "  flow cycles %u", m->cycles_total);
    for (uint16_t i = 0; i < m->prog->n_flows && n > 0 && (size_t)n < sizeof s; i++)
        n += snprintf(s + n, sizeof s - (size_t)n, " · %s step %u", m->prog->flow[i].name, m->inst[i].pc);
    return s;
}

static void logf_(const char *fmt, ...)
{
    char line[1024], stamp[32];
    time_t now = time(NULL);
    strftime(stamp, sizeof stamp, "%Y-%m-%d %H:%M:%S", localtime(&now));
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(line, sizeof line, fmt, ap);
    va_end(ap);
    printf("%s  %s\n", stamp, line);
    fflush(stdout);
    if (g_log) {
        fprintf(g_log, "%s  %s\n", stamp, line);
        fflush(g_log);
    }
}

/* design 5b: inputs → commands → (flows: step 37) → machine → outputs → publish → stats.
 * No allocation, no waiting, no file or socket here. */
static void rt_cycle(void *user, uint64_t deadline_us, uint64_t start_us)
{
    Runtime *r = (Runtime *)user;
    uint32_t dt = r->last_us ? (uint32_t)(start_us - r->last_us) : r->cfg.cycle_us;
    r->last_us = start_us;
    if (dt > r->per_max_cur) r->per_max_cur = dt;
    if (start_us - r->sec_start >= 1000000u) { /* the longest period of the last second, for the studio's link chip */
        os_atomic_store(&r->per_max_1s, r->per_max_cur);
        r->per_max_cur = 0;
        r->sec_start = start_us;
    }
    r->card.vt->read_inputs(&r->card, dt);                                               /* 1. inputs */
    io_read_inputs(&r->tags, &r->card, &r->io, (uint32_t)((start_us - r->t0) / 1000u));
    r->card.vt->axes_update(&r->card, dt);
    Cmd c;
    for (int k = 0; k < 16 && !cmdq_pop(&r->cmdq, &c); k++) machine_cmd(&r->machine, &c, start_us, &r->tags, &r->card); /* 2. commands */
    machine_flows(&r->machine, start_us);                                                 /* 3. flows (step 37) */
    machine_tick(&r->machine, start_us);                                                  /* 4. machine */
    io_write_outputs(&r->tags, &r->card, &r->io);                                         /* 5. outputs */
    vtri_publish(&r->values, &r->tags, r->machine.pcs, r->machine.prog ? (uint8_t)r->machine.prog->n_flows : 0); /* 6. → comm */
    stats_cycle(&r->stats, deadline_us, start_us, os_now_us());                           /* 7. statistics */
}

static int fail(int code, const Err *e)
{
    logf_("ERROR: %s", e->msg);
    return code;
}

int main(int argc, char **argv)
{
    const char *cfg_path = "config.json";
    double seconds = 0; /* 0 = until Ctrl+C */
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8); /* the log lines are UTF-8 ("·", "µ") */
#endif
    for (int i = 1; i < argc; i++) {
        if (str_eq(argv[i], "--version") || str_eq(argv[i], "-v")) {
            printf("spm_rt %s\n", SPM_RT_VERSION);
            return 0;
        } else if (str_eq(argv[i], "--seconds") && i + 1 < argc)
            seconds = atof(argv[++i]);
        else if (str_eq(argv[i], "--help") || str_eq(argv[i], "-h")) {
            printf("spm_rt [config.json] [--seconds N] [--version]\n");
            return 0;
        } else
            cfg_path = argv[i];
    }
    Err e = {""};
    if (cfg_load(cfg_path, &g.cfg, &e)) return fail(1, &e);
    os_mkdirs_for(g.cfg.log_path);
    g_log = fopen(g.cfg.log_path, "a");
    logf_("spm_rt %s · config %s", SPM_RT_VERSION, cfg_path);
    if (arena_init(&g.arena, 64u << 20)) return fail(2, &(Err){"out of memory (load arena)"});
    if (tagdb_load(g.cfg.tags_path, &g.arena, &g.tags, &e)) return fail(2, &e);
    if (card_open(&g.card, &g.cfg, &e)) return fail(3, &e);
    if (io_map_bind(&g.tags, &g.card, &g.arena, &g.io, &e)) return fail(4, &e);
    logf_("tags %u from %s (tags_crc %08X) · I/O %u in, %u out · card %s · %u cylinder(s) in the sim model", g.tags.n, g.cfg.tags_path,
          g.tags.crc, g.io.n_in, g.io.n_out, g.card.vt->name, ((SimCard *)g.card.impl)->n_cyl);

    machine_init(&g.machine, &g.events, g.cfg.sim_demo_alarms);
    machine_bind(&g.machine, &g.tags, &g.card);
    Prog *prog = NULL;
    int prc = prog_load_file(g.cfg.program_path, &g.tags, &prog, &e);
    if (prc > 1) return fail(7, &e);
    if (prog) {
        machine_start_program(&g.machine, prog, os_now_us());
        logf_("program %s from %s · %u flow%s, %u steps · runs in EXECUTE", prog->meta.crc, g.cfg.program_path, prog->n_flows,
              prog->n_flows == 1 ? "" : "s", prog->meta.n_steps);
    } else
        logf_("no %s yet · Download one from the studio", g.cfg.program_path);
    if (vtri_init(&g.values, g.tags.n, &g.arena)) return fail(2, &(Err){"out of memory (value buffers)"});
    vtri_publish(&g.values, &g.tags, g.machine.pcs, 0);
    CommConf cc = {g.cfg.ws_port, SPM_RT_VERSION, g.cfg.cycle_us, &g.per_max_1s, &g.tags, &g.cmdq, &g.events, &g.values, logf_};
    Comm *comm = comm_start(&cc, &e);
    if (!comm) return fail(6, &e);
    logf_("link: ws://127.0.0.1:%u (this PC only) · %s", g.cfg.ws_port,
          g.cfg.sim_demo_alarms ? "SimCard alarm demo on (W0310 after 6 s, E1202 after 12 s in EXECUTE)" : "alarm demo off");
    stats_init(&g.stats, g.cfg.cycle_us);
    g.rt.period_us = g.cfg.cycle_us;
    g.rt.spin_us = g.cfg.spin_us;
    g.rt.cpu = g.cfg.cpu;
    g.rt.cycle = rt_cycle;
    g.rt.user = &g;
    g.t0 = os_now_us();
    os_shutdown_install();
    if (os_rt_start(&g.rt, &e)) return fail(5, &e);
    os_sleep_ms(50);
    logf_("cycle %u us · %s · stats every %u s%s", g.cfg.cycle_us, g.rt.prio_note, g.cfg.stats_s, seconds > 0 ? "" : " · Ctrl+C stops");

    uint64_t next = g.t0 + (uint64_t)g.cfg.stats_s * 1000000u, end = seconds > 0 ? g.t0 + (uint64_t)(seconds * 1e6) : 0;
    char line[512];
    while (!os_shutdown_requested() && (!end || os_now_us() < end)) {
        os_sleep_ms(1);  /* step 36: 1 ms, so an answer leaves within ~1 ms of the RT cycle (measured: 5 ms sleep → 5 ms median) */
        comm_pump(comm); /* answers, machine and alarm events out; state frames at 20 Hz */
        if (os_now_us() < next) continue;
        next += (uint64_t)g.cfg.stats_s * 1000000u;
        CycleWin w;
        if (stats_take(&g.stats, &w, 1000)) {
            logf_("WARNING: the RT thread did not answer within 1 s");
            continue;
        }
        stats_line(&w, line, sizeof line);
        logf_("t=%.0f s  %s  missed %u%s", (double)(os_now_us() - g.t0) / 1e6, line, g.rt.missed, flows_note(&g.machine));
    }
    os_rt_stop(&g.rt);
    comm_pump(comm);
    comm_stop(comm);
    if (g.events.lost) logf_("WARNING: %u events were lost (event ring full)", g.events.lost);
    free(g.machine.prog);
    io_all_safe(&g.tags, &g.card, &g.io);
    card_close(&g.card);
    stats_line(&g.stats.total, line, sizeof line);
    logf_("stopped after %.0f s · outputs safe · TOTAL %s  missed %u%s", (double)(os_now_us() - g.t0) / 1e6, line, g.rt.missed, flows_note(&g.machine));
    logf_("max jitter over the run: %u us (cycle %u us)", g.stats.total.jit_max, g.cfg.cycle_us);
    if (g_log) fclose(g_log);
    arena_free(&g.arena);
    return 0;
}

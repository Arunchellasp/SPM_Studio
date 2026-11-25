/*
 * spm_rt — the SPM real-time runtime (Software implementation › 5a).
 * Step 35: load config.json + tags.json, open the card (SimCard), bind the I/O, run the cycle every
 * cycle_us with jitter statistics, log them. Next: WebSocket server (step 36), flow engine (step 37).
 *
 *   spm_rt [config.json] [--seconds N]     (Ctrl+C stops; outputs go to safe, the summary is logged)
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
} Runtime;
static Runtime g;
static FILE *g_log;

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

/* design 5b: inputs → (commands, flows, alarms: steps 36–37) → outputs → stats. No allocation, no I/O to files here. */
static void rt_cycle(void *user, uint64_t deadline_us, uint64_t start_us)
{
    Runtime *r = (Runtime *)user;
    uint32_t dt = r->last_us ? (uint32_t)(start_us - r->last_us) : r->cfg.cycle_us;
    r->last_us = start_us;
    r->card.vt->read_inputs(&r->card, dt);
    io_read_inputs(&r->tags, &r->card, &r->io, (uint32_t)((start_us - r->t0) / 1000u));
    r->card.vt->axes_update(&r->card, dt);
    io_write_outputs(&r->tags, &r->card, &r->io);
    stats_cycle(&r->stats, deadline_us, start_us, os_now_us());
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
        os_sleep_ms(50);
        if (os_now_us() < next) continue;
        next += (uint64_t)g.cfg.stats_s * 1000000u;
        CycleWin w;
        if (stats_take(&g.stats, &w, 1000)) {
            logf_("WARNING: the RT thread did not answer within 1 s");
            continue;
        }
        stats_line(&w, line, sizeof line);
        logf_("t=%.0f s  %s  missed %u", (double)(os_now_us() - g.t0) / 1e6, line, g.rt.missed);
    }
    os_rt_stop(&g.rt);
    io_all_safe(&g.tags, &g.card, &g.io);
    card_close(&g.card);
    stats_line(&g.stats.total, line, sizeof line);
    logf_("stopped after %.0f s · outputs safe · TOTAL %s  missed %u", (double)(os_now_us() - g.t0) / 1e6, line, g.rt.missed);
    logf_("max jitter over the run: %u us (cycle %u us)", g.stats.total.jit_max, g.cfg.cycle_us);
    if (g_log) fclose(g_log);
    arena_free(&g.arena);
    return 0;
}

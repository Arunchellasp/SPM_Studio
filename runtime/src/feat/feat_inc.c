#ifdef _WIN32
#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#endif
#include <stdio.h>
#include <string.h>
#include "../os/os_inc.h"
#include "feat_inc.h"

/* ---------------------------------------------------------------- I/O map */
int io_map_bind(TagDB *db, Card *c, Arena *a, IoMap *m, Err *e)
{
    memset(m, 0, sizeof *m);
    m->in = (uint16_t *)arena_push(a, sizeof(uint16_t) * (size_t)(db->n ? db->n : 1));
    m->out = (uint16_t *)arena_push(a, sizeof(uint16_t) * (size_t)(db->n ? db->n : 1));
    if (!m->in || !m->out) return err_set(e, 4, "load arena full");
    static uint16_t used[4][CARD_IO_MAX]; /* tag id + 1 per channel and kind: a channel used twice is an error */
    memset(used, 0, sizeof used);
    for (uint16_t i = 0; i < db->n; i++) {
        Tag *t = &db->t[i];
        int io = t->kind == K_DI || t->kind == K_DO || t->kind == K_AI || t->kind == K_AO;
        if (!io && t->kind != K_AXIS) continue;
        Err why = {""};
        int ch = c->vt->channel(c, t->kind, t->addr, &why);
        if (ch < 0) return err_set(e, 4, "tag \"%s\": %s", t->name, why.msg);
        t->io = ch;
        if (!io) continue;
        uint16_t *u = &used[t->kind][ch];
        if (*u) return err_set(e, 4, "tags \"%s\" and \"%s\" use the same %s channel", db->t[*u - 1].name, t->name, kind_name(t->kind));
        *u = (uint16_t)(i + 1);
        if (t->kind == K_DI || t->kind == K_AI) m->in[m->n_in++] = i;
        else m->out[m->n_out++] = i;
    }
    return c->vt->bind(c, db, e) ? 4 : 0;
}

static int changed(const Tag *t)
{
    return t->dtype == D_REAL ? t->v.f != t->prev.f : t->v.i != t->prev.i;
}

void io_read_inputs(TagDB *db, const Card *c, const IoMap *m, uint32_t now_ms)
{
    for (uint16_t k = 0; k < m->n_in; k++) {
        Tag *t = &db->t[m->in[k]];
        t->prev = t->v;
        if (t->kind == K_DI) {
            t->v.i = 0;
            t->v.b = (uint8_t)((c->di[t->io] ? 1 : 0) ^ ((t->flags & F_INVERT) ? 1 : 0));
        } else
            t->v.f = c->ai[t->io] * t->k + t->o;
        if (changed(t)) t->t_change = now_ms;
    }
}

void io_write_outputs(const TagDB *db, Card *c, const IoMap *m)
{
    for (uint16_t k = 0; k < m->n_out; k++) {
        const Tag *t = &db->t[m->out[k]];
        if (t->kind == K_DO) c->dout[t->io] = (uint8_t)((t->v.b ? 1 : 0) ^ ((t->flags & F_INVERT) ? 1 : 0));
        else c->ao[t->io] = t->k != 0.0f ? (t->v.f - t->o) / t->k : 0.0f;
    }
    c->vt->write_outputs(c);
}

void io_all_safe(TagDB *db, Card *c, const IoMap *m)
{
    for (uint16_t k = 0; k < m->n_out; k++) {
        Tag *t = &db->t[m->out[k]];
        t->v.i = 0;
        if (t->kind == K_AO) t->v.f = 0.0f; /* safe_state from tags.json: with the alarm reactions (later step) */
    }
    io_write_outputs(db, c, m);
}

/* ---------------------------------------------------------------- cycle statistics */
const char *const JIT_LABELS[JIT_BUCKETS] = {"<=10", "<=50", "<=100", "<=250", "<=500", ">500"};

static void win_reset(CycleWin *w)
{
    memset(w, 0, sizeof *w);
    w->per_min = UINT32_MAX;
}

void stats_init(CycleStats *s, uint32_t nominal_us)
{
    memset(s, 0, sizeof *s);
    s->nominal_us = nominal_us;
    win_reset(&s->win);
    win_reset(&s->total);
}

static void win_add(CycleWin *w, int has_period, uint32_t per, uint32_t jit, uint32_t late, uint32_t exec, int over)
{
    w->n++;
    if (late > w->late_max) w->late_max = late;
    if (exec > w->exec_max) w->exec_max = exec;
    if (over) w->overruns++;
    if (!has_period) return;
    if (per < w->per_min) w->per_min = per;
    if (per > w->per_max) w->per_max = per;
    w->per_sum += per;
    if (jit > w->jit_max) w->jit_max = jit;
    int b = jit <= 10 ? 0 : jit <= 50 ? 1 : jit <= 100 ? 2 : jit <= 250 ? 3 : jit <= 500 ? 4 : 5;
    w->hist[b]++;
}

void stats_cycle(CycleStats *s, uint64_t deadline_us, uint64_t start_us, uint64_t end_us)
{
    int has = s->last_start != 0;
    uint32_t per = has ? (uint32_t)(start_us - s->last_start) : 0;
    uint32_t jit = !has ? 0 : per > s->nominal_us ? per - s->nominal_us : s->nominal_us - per;
    uint32_t late = start_us > deadline_us ? (uint32_t)(start_us - deadline_us) : 0;
    uint32_t exec = (uint32_t)(end_us - start_us);
    s->last_start = start_us;
    win_add(&s->win, has, per, jit, late, exec, exec > s->nominal_us);
    win_add(&s->total, has, per, jit, late, exec, exec > s->nominal_us);
    if (os_atomic_load(&s->snap_req)) { /* the main thread asked for the window: hand it over, start a new one */
        s->snap = s->win;
        win_reset(&s->win);
        os_atomic_store(&s->snap_req, 0);
        os_atomic_store(&s->snap_ready, 1);
    }
}

int stats_take(CycleStats *s, CycleWin *out, uint32_t wait_ms)
{
    os_atomic_store(&s->snap_ready, 0);
    os_atomic_store(&s->snap_req, 1);
    for (uint32_t t = 0; t <= wait_ms; t++) {
        if (os_atomic_load(&s->snap_ready)) {
            *out = s->snap;
            return 0;
        }
        os_sleep_ms(1);
    }
    os_atomic_store(&s->snap_req, 0);
    return 1; /* the RT thread did not answer: it is stuck */
}

double stats_avg(const CycleWin *w)
{
    uint64_t np = w->hist[0] + w->hist[1] + w->hist[2] + w->hist[3] + w->hist[4] + w->hist[5];
    return np ? (double)w->per_sum / (double)np : 0.0;
}

int stats_line(const CycleWin *w, char *buf, size_t cap)
{
    return snprintf(buf, cap,
                    "cycles %llu  period %u..%u us (avg %.1f)  jitter max %u us  late max %u us  exec max %u us  overruns %llu  "
                    "[%s:%llu %s:%llu %s:%llu %s:%llu %s:%llu %s:%llu]",
                    (unsigned long long)w->n, w->per_min == UINT32_MAX ? 0u : w->per_min, w->per_max, stats_avg(w), w->jit_max, w->late_max,
                    w->exec_max, (unsigned long long)w->overruns, JIT_LABELS[0], (unsigned long long)w->hist[0], JIT_LABELS[1],
                    (unsigned long long)w->hist[1], JIT_LABELS[2], (unsigned long long)w->hist[2], JIT_LABELS[3], (unsigned long long)w->hist[3],
                    JIT_LABELS[4], (unsigned long long)w->hist[4], JIT_LABELS[5], (unsigned long long)w->hist[5]);
}

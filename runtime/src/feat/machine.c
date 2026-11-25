/*
 * feat — step 36: the machine as the RT thread owns it.
 *   PackML: the table of the studio's shared/packml.ts, word for word (also the refusal texts).
 *   Alarms: the list rule of shared/alarms.ts applyAlarm; the SimCard demo of the mock runtime (sim.demo_alarms).
 *   Command queue (comm → RT), event ring (RT → comm), value triple buffer (RT → comm): nothing here waits
 *   or allocates — the RT cycle drains the queue, steps the machine and publishes, all in microseconds.
 */
#include <stdio.h>
#include <string.h>

/* ---------------------------------------------------------------- PackML */
static const char *const PS_NAMES[PS_COUNT] = {"STOPPED",   "IDLE",     "EXECUTE",   "COMPLETE",    "HELD",       "SUSPENDED",
                                                "ABORTED",   "RESETTING", "STARTING", "COMPLETING",  "HOLDING",    "UNHOLDING",
                                                "SUSPENDING", "UNSUSPENDING", "STOPPING", "ABORTING", "CLEARING"};
static const char *const PM_NAMES[PM_COUNT] = {"Auto", "Manual", "Maintenance"};

const char *pack_state_name(PackState s) { return (unsigned)s < PS_COUNT ? PS_NAMES[s] : "?"; }
const char *pack_mode_name(PackMode m) { return (unsigned)m < PM_COUNT ? PM_NAMES[m] : "?"; }
int pack_mode_parse(const char *s)
{
    for (int i = 0; s && i < PM_COUNT; i++)
        if (str_eq(s, PM_NAMES[i])) return i;
    return -1;
}
int pack_is_acting(PackState s) { return s >= PS_RESETTING && s < PS_COUNT; }
PackState pack_settle(PackState s)
{
    switch (s) {
    case PS_RESETTING: return PS_IDLE;
    case PS_STARTING: return PS_EXECUTE;
    case PS_COMPLETING: return PS_COMPLETE;
    case PS_HOLDING: return PS_HELD;
    case PS_UNHOLDING: return PS_EXECUTE;
    case PS_SUSPENDING: return PS_SUSPENDED;
    case PS_UNSUSPENDING: return PS_EXECUTE;
    case PS_STOPPING: return PS_STOPPED;
    case PS_ABORTING: return PS_ABORTED;
    case PS_CLEARING: return PS_STOPPED;
    default: return s;
    }
}
static int no_stop(PackState s)
{
    return s == PS_STOPPED || s == PS_STOPPING || s == PS_ABORTING || s == PS_ABORTED || s == PS_CLEARING;
}
int pack_command(PackState s, PackCmd c, PackState *next, char *reason, size_t cap)
{
    static const char *const WORD[] = {"Start", "Hold", "Stop", "Reset"};
    static const char *const WHERE[] = {"IDLE or HELD", "EXECUTE", "any state except STOPPED and the abort group",
                                        "STOPPED, COMPLETE or ABORTED"};
    PackState n = PS_COUNT;
    switch (c) {
    case PC_START: n = s == PS_IDLE ? PS_STARTING : s == PS_HELD ? PS_UNHOLDING : PS_COUNT; break; /* Start on held = Unhold */
    case PC_HOLD: n = s == PS_EXECUTE ? PS_HOLDING : PS_COUNT; break;
    case PC_STOP: n = no_stop(s) ? PS_COUNT : PS_STOPPING; break;
    case PC_RESET: n = (s == PS_STOPPED || s == PS_COMPLETE) ? PS_RESETTING : s == PS_ABORTED ? PS_CLEARING : PS_COUNT; break;
    }
    if (n != PS_COUNT) {
        *next = n;
        return 0;
    }
    snprintf(reason, cap, "%s is not possible in %s (only in %s)", WORD[c], pack_state_name(s), WHERE[c]);
    return 1;
}
int pack_abort(PackState s, PackState *next)
{
    if (s == PS_ABORTING || s == PS_ABORTED || s == PS_CLEARING) return 1;
    *next = PS_ABORTING;
    return 0;
}
int pack_mode_ok(PackState s, char *reason, size_t cap)
{
    if (s == PS_STOPPED || s == PS_IDLE || s == PS_ABORTED) return 0;
    snprintf(reason, cap, "the mode can change only in STOPPED, IDLE or ABORTED (now %s)", pack_state_name(s));
    return 1;
}

/* ---------------------------------------------------------------- alarms */
static const AlarmDef ALARM_DEFS[] = {{"E1202", "Plasma ready signal lost during cleaning (station 2)", 1},
                                      {"W0310", "Glue level below 20 % (station 3)", 3}};
const AlarmDef *alarm_def(const char *code)
{
    for (size_t i = 0; i < sizeof ALARM_DEFS / sizeof ALARM_DEFS[0]; i++)
        if (str_eq(code, ALARM_DEFS[i].code)) return &ALARM_DEFS[i];
    return NULL;
}
const AlarmEntry *alarm_find(const AlarmList *l, const char *code)
{
    for (uint16_t i = 0; i < l->n; i++)
        if (str_eq(l->a[i].code, code)) return &l->a[i];
    return NULL;
}
int alarm_has(const AlarmList *l, const char *code)
{
    const AlarmEntry *a = alarm_find(l, code);
    return a && a->active;
}
static void alarm_remove(AlarmList *l, const char *code)
{
    for (uint16_t i = 0; i < l->n; i++)
        if (str_eq(l->a[i].code, code)) {
            memmove(&l->a[i], &l->a[i + 1], (size_t)(l->n - i - 1) * sizeof l->a[0]);
            l->n--;
            return;
        }
}
void alarm_apply(AlarmList *l, AlarmAct act, const char *code, const char *text, uint8_t priority, const char *time)
{
    AlarmEntry *has = (AlarmEntry *)alarm_find(l, code);
    switch (act) {
    case AL_RAISE: /* again while still in the list: active again, needs a new ack (it moves to the end) */
        alarm_remove(l, code);
        if (l->n < ALARM_MAX) {
            AlarmEntry *a = &l->a[l->n++];
            memset(a, 0, sizeof *a);
            snprintf(a->code, sizeof a->code, "%s", code);
            a->text = text;
            a->priority = priority;
            snprintf(a->time, sizeof a->time, "%s", time ? time : "");
            a->active = 1;
        }
        break;
    case AL_ACK:
        if (!has) break;
        if (!has->active)
            alarm_remove(l, code);
        else
            has->acked = 1;
        break;
    case AL_CLEAR:
        if (!has) break;
        if (has->acked)
            alarm_remove(l, code);
        else
            has->active = 0;
        break;
    }
}

/* ---------------------------------------------------------------- command queue: many producers (locked by the caller), one consumer */
int cmdq_push(CmdQueue *q, const Cmd *c)
{
    uint32_t h = q->head, t = os_atomic_load(&q->tail);
    if (h - t >= CMDQ_N) return 1;
    q->q[h % CMDQ_N] = *c;
    os_atomic_store(&q->head, h + 1);
    return 0;
}
int cmdq_pop(CmdQueue *q, Cmd *c)
{
    uint32_t t = q->tail, h = os_atomic_load(&q->head);
    if (t == h) return 1;
    *c = q->q[t % CMDQ_N];
    os_atomic_store(&q->tail, t + 1);
    return 0;
}

/* ---------------------------------------------------------------- event ring: one producer (RT), one consumer (pump) */
void evr_push(EvRing *r, const Ev *e)
{
    uint32_t h = r->head, t = os_atomic_load(&r->tail);
    if (h - t >= EVR_N) {
        r->lost++;
        return;
    }
    r->e[h % EVR_N] = *e;
    os_atomic_store(&r->head, h + 1);
}
int evr_pop(EvRing *r, Ev *e)
{
    uint32_t t = r->tail, h = os_atomic_load(&r->head);
    if (t == h) return 1;
    *e = r->e[t % EVR_N];
    os_atomic_store(&r->tail, t + 1);
    return 0;
}

/* ---------------------------------------------------------------- value triple buffer */
#define VT_FRESH 4u
int vtri_init(ValueTriple *t, uint16_t n, Arena *a)
{
    memset(t, 0, sizeof *t);
    t->n = n;
    for (int i = 0; i < 3; i++)
        if (!(t->buf[i] = (Value *)arena_push(a, sizeof(Value) * (n ? n : 1u)))) return 1;
    t->back = 0;
    t->mid = 1;
    t->front = 2;
    return 0;
}
void vtri_publish(ValueTriple *t, const TagDB *db)
{
    Value *b = t->buf[t->back];
    for (uint16_t i = 0; i < t->n; i++) b[i] = db->t[i].v;
    t->back = os_atomic_xchg(&t->mid, t->back | VT_FRESH) & 3u;
}
const Value *vtri_read(ValueTriple *t)
{
    if (os_atomic_load(&t->mid) & VT_FRESH) t->front = os_atomic_xchg(&t->mid, t->front) & 3u;
    return t->buf[t->front];
}

/* ---------------------------------------------------------------- the machine (RT thread) */
void machine_init(Machine *m, EvRing *out, int demo)
{
    memset(m, 0, sizeof *m);
    m->state = PS_STOPPED;
    m->mode = PM_AUTO;
    m->out = out;
    m->demo = (uint8_t)demo;
}
static void emit_machine(Machine *m)
{
    Ev e;
    memset(&e, 0, sizeof e);
    e.type = EV_MACHINE;
    e.state = (uint8_t)m->state;
    e.mode = (uint8_t)m->mode;
    if (m->prog) memcpy(e.prog, m->prog->crc, 9);
    evr_push(m->out, &e);
}
static void emit_res(Machine *m, const Cmd *c, int ok, const char *err, const char *msg)
{
    Ev e;
    memset(&e, 0, sizeof e);
    e.type = EV_RES;
    e.client = c->client;
    e.id = c->id;
    e.ok = (uint8_t)ok;
    if (err) snprintf(e.err, sizeof e.err, "%s", err);
    if (msg) snprintf(e.msg, sizeof e.msg, "%s", msg);
    evr_push(m->out, &e);
}
static void emit_alarm(Machine *m, AlarmAct act, const char *code, const char *by)
{
    const AlarmDef *d = alarm_def(code);
    Ev e;
    memset(&e, 0, sizeof e);
    e.type = EV_ALARM;
    e.act = (uint8_t)act;
    snprintf(e.code, sizeof e.code, "%s", code);
    if (act == AL_RAISE && d) {
        e.text = d->text;
        e.priority = d->priority;
    }
    if (by) snprintf(e.by, sizeof e.by, "%s", by);
    alarm_apply(&m->alarms, act, code, e.text, e.priority, NULL);
    evr_push(m->out, &e);
}
static void alarm_clear_if(Machine *m, const char *code)
{
    if (alarm_find(&m->alarms, code)) emit_alarm(m, AL_CLEAR, code, NULL);
}
/* every state change: the event, then what the mock runtime does on that state (alarm demo timers, E1202 clear) */
static void set_state(Machine *m, PackState s, uint64_t now)
{
    m->state = s;
    m->acting_until = pack_is_acting(s) ? now + PACK_ACTING_MS * 1000ull : 0;
    emit_machine(m);
    m->t_w0310 = m->t_e1202 = 0;
    if (m->demo && s == PS_EXECUTE) {
        m->t_w0310 = now + 6000000ull;
        m->t_e1202 = now + 12000000ull;
    }
    if (s == PS_STOPPED) alarm_clear_if(m, "E1202"); /* cleared by Reset after the abort */
}

void machine_cmd(Machine *m, const Cmd *c, uint64_t now, TagDB *db, Card *card)
{
    char why[160];
    switch ((CmdOp)c->op) {
    case OP_START:
    case OP_HOLD:
    case OP_STOP:
    case OP_RESET: {
        static const PackCmd PC[] = {PC_START, PC_HOLD, PC_STOP, PC_RESET};
        PackState next;
        if (pack_command(m->state, PC[c->op], &next, why, sizeof why)) {
            emit_res(m, c, 0, "STATE", why);
            return;
        }
        set_state(m, next, now);
        emit_res(m, c, 1, NULL, NULL);
        return;
    }
    case OP_MODE:
        if (pack_mode_ok(m->state, why, sizeof why)) {
            emit_res(m, c, 0, "MODE", why);
            return;
        }
        m->mode = (PackMode)c->mode;
        emit_machine(m);
        if (m->state == PS_STOPPED) alarm_clear_if(m, "E1202");
        emit_res(m, c, 1, NULL, NULL);
        return;
    case OP_ACK: {
        const AlarmEntry *a = alarm_find(&m->alarms, c->code);
        if (!a) {
            snprintf(why, sizeof why, "no alarm %s in the list", c->code);
            emit_res(m, c, 0, "ALARM", why);
        } else if (a->acked) {
            snprintf(why, sizeof why, "%s is already acknowledged", c->code);
            emit_res(m, c, 0, "ALARM", why);
        } else {
            emit_alarm(m, AL_ACK, c->code, c->user[0] ? c->user : "unknown user");
            emit_res(m, c, 1, NULL, NULL);
        }
        return;
    }
    case OP_DOWNLOAD: {
        Ev e;
        memset(&e, 0, sizeof e);
        e.type = EV_RES;
        e.client = c->client;
        e.id = c->id;
        if (m->state != PS_STOPPED) {
            snprintf(e.err, sizeof e.err, "STATE");
            snprintf(e.msg, sizeof e.msg, "download only in STOPPED (now %s)", pack_state_name(m->state));
            e.free_me = c->prog; /* not taken: the comm side frees it */
            evr_push(m->out, &e);
            return;
        }
        e.free_me = m->prog; /* the old program goes back to be freed */
        m->prog = c->prog;
        e.ok = 1;
        memcpy(e.crc, m->prog->crc, 9);
        evr_push(m->out, &e);
        emit_machine(m); /* everyone sees the new program CRC */
        return;
    }
    case OP_WRITE: {
        if (c->tag < 0 || c->tag >= db->n) {
            snprintf(why, sizeof why, "no tag %d in tags.json", (int)c->tag);
            emit_res(m, c, 0, "UNKNOWN_TAG", why);
            return;
        }
        Tag *t = &db->t[c->tag];
        Value v;
        memset(&v, 0, sizeof v);
        if (t->dtype == D_BOOL)
            v.b = (uint8_t)(c->value != 0);
        else if (t->dtype == D_REAL)
            v.f = (float)c->value;
        else
            v.i = (int32_t)c->value;
        if (t->io >= 0 && (t->kind == K_DI || t->kind == K_AI)) { /* an input: simulated on the SimCard's process image */
            if (!str_eq(card->vt->name, "SimCard")) {
                emit_res(m, c, 0, "SIM_ONLY", "inputs can be written only on the SimCard (force / simulate: step 38)");
                return;
            }
            if (t->kind == K_DI)
                card->di[t->io] = (uint8_t)((v.b ? 1 : 0) ^ ((t->flags & F_INVERT) ? 1 : 0));
            else
                card->ai[t->io] = t->k != 0.0f ? ((float)c->value - t->o) / t->k : 0.0f;
        } else
            t->v = v;
        emit_res(m, c, 1, NULL, NULL);
        return;
    }
    default:
        emit_res(m, c, 0, "UNKNOWN_OP", "op not supported");
        return;
    }
}

void machine_tick(Machine *m, uint64_t now)
{
    if (m->acting_until && now >= m->acting_until) set_state(m, pack_settle(m->state), now);
    if (m->t_w0310 && now >= m->t_w0310) {
        m->t_w0310 = 0;
        if (!alarm_has(&m->alarms, "W0310")) {
            emit_alarm(m, AL_RAISE, "W0310", NULL);
            m->t_w0310_clear = now + 10000000ull; /* glue refilled */
        }
    }
    if (m->t_w0310_clear && now >= m->t_w0310_clear) {
        m->t_w0310_clear = 0;
        alarm_clear_if(m, "W0310");
    }
    if (m->t_e1202 && now >= m->t_e1202) {
        m->t_e1202 = 0;
        PackState next;
        if (!m->prog) { /* with a program loaded the sequence is left running (as the mock) */
            emit_alarm(m, AL_RAISE, "E1202", NULL);
            if (!pack_abort(m->state, &next)) set_state(m, next, now); /* P1 → Abort */
        }
    }
}

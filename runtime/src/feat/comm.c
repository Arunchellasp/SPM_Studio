/*
 * feat — step 36: the studio link (Software implementation › 'Comm thread', 5b step 2 and 6).
 *
 *   studio ──ws://127.0.0.1:7600──► civetweb threads: decode, check the message, answer what needs no machine
 *                                     (ping, malformed or unknown commands, a download that fails its CRC),
 *                                     everything else → command queue ──► RT cycle (machine_cmd)
 *   studio ◄── pump (main thread, every few ms): event ring ◄── RT cycle (answers, machine, alarms)
 *          ◄── state frames at 20 Hz: changed tag values, read from the value triple buffer
 *
 * The same messages as the mock runtime (studio/tools/mock-runtime.mjs, schemas/message.schema.json).
 * The RT thread never waits for the comm side and never touches a socket.
 */
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../third_party/civetweb/civetweb.h"

/* ---------------------------------------------------------------- JSON text helpers (comm side: malloc is fine here) */
static int json_esc(Buf *b, const char *s)
{
    int rc = buf_put(b, "\"", 1);
    for (const unsigned char *p = (const unsigned char *)(s ? s : ""); *p && !rc; p++) {
        char tmp[8];
        switch (*p) {
        case '"': rc = buf_str(b, "\\\""); break;
        case '\\': rc = buf_str(b, "\\\\"); break;
        case '\b': rc = buf_str(b, "\\b"); break;
        case '\f': rc = buf_str(b, "\\f"); break;
        case '\n': rc = buf_str(b, "\\n"); break;
        case '\r': rc = buf_str(b, "\\r"); break;
        case '\t': rc = buf_str(b, "\\t"); break;
        default:
            if (*p < 0x20) {
                snprintf(tmp, sizeof tmp, "\\u%04x", *p);
                rc = buf_str(b, tmp);
            } else
                rc = buf_put(b, (const char *)p, 1);
        }
    }
    return rc | buf_put(b, "\"", 1);
}
static char *buf_done(Buf *b, int rc)
{
    if (rc) {
        free(b->p);
        return NULL;
    }
    return b->p;
}

/* ---------------------------------------------------------------- decode: one text frame from the studio */
static const char *const OP_NAMES[OP_COUNT] = {"start", "hold", "stop", "reset", "mode", "ack", "download", "write"};

static void bad(Msg *m, const char *err, const char *fmt, ...)
{
    m->kind = MSG_BAD_CMD;
    snprintf(m->err, sizeof m->err, "%s", err);
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(m->why, sizeof m->why, fmt, ap);
    va_end(ap);
}
/* String(v) of JavaScript, for the messages that quote a value the studio sent */
static void js_string(const cJSON *v, char *out, size_t cap)
{
    if (!v)
        snprintf(out, cap, "undefined");
    else if (cJSON_IsString(v))
        snprintf(out, cap, "%s", v->valuestring);
    else {
        char *s = cJSON_PrintUnformatted(v);
        snprintf(out, cap, "%s", s ? s : "?");
        if (s) cJSON_free(s);
    }
}

MsgKind msg_decode(const char *text, size_t n, Msg *m)
{
    memset(m, 0, sizeof *m);
    m->cmd.tag = -1;
    cJSON *root = cJSON_ParseWithLength(text, n);
    const cJSON *t = cJSON_IsObject(root) ? cJSON_GetObjectItemCaseSensitive(root, "t") : NULL;
    if (!cJSON_IsString(t)) { /* not JSON, or no "t": ignored (as the mock does) */
        cJSON_Delete(root);
        return m->kind = MSG_IGNORE;
    }
    if (str_eq(t->valuestring, "ping")) {
        cJSON_Delete(root);
        return m->kind = MSG_PING;
    }
    if (!str_eq(t->valuestring, "cmd")) {
        cJSON_Delete(root);
        return m->kind = MSG_IGNORE;
    }
    const cJSON *id = cJSON_GetObjectItemCaseSensitive(root, "id"), *op = cJSON_GetObjectItemCaseSensitive(root, "op");
    m->cmd.id = cJSON_IsNumber(id) ? (int32_t)id->valuedouble : 0;
    js_string(op, m->op, sizeof m->op);
    int k = -1;
    for (int i = 0; cJSON_IsString(op) && i < OP_COUNT; i++)
        if (str_eq(op->valuestring, OP_NAMES[i])) k = i;
    m->kind = MSG_CMD;
    if (k < 0) {
        bad(m, "UNKNOWN_OP", "op '%s' not supported", m->op);
    } else {
        m->cmd.op = (uint8_t)k;
        switch ((CmdOp)k) {
        case OP_MODE: {
            const cJSON *mo = cJSON_GetObjectItemCaseSensitive(root, "mode");
            int pm = cJSON_IsString(mo) ? pack_mode_parse(mo->valuestring) : -1;
            char s[64];
            js_string(mo, s, sizeof s);
            if (pm < 0)
                bad(m, "MODE", "unknown mode '%s'", s);
            else
                m->cmd.mode = (uint8_t)pm;
            break;
        }
        case OP_ACK: {
            const cJSON *code = cJSON_GetObjectItemCaseSensitive(root, "code"), *user = cJSON_GetObjectItemCaseSensitive(root, "user");
            js_string(code, m->cmd.code, sizeof m->cmd.code);
            if (cJSON_IsString(user)) snprintf(m->cmd.user, sizeof m->cmd.user, "%s", user->valuestring);
            break;
        }
        case OP_DOWNLOAD:
            m->rt = cJSON_DetachItemFromObjectCaseSensitive(root, "rt");
            break;
        case OP_WRITE: {
            const cJSON *tag = cJSON_GetObjectItemCaseSensitive(root, "tag"), *v = cJSON_GetObjectItemCaseSensitive(root, "value");
            char s[64];
            js_string(tag, s, sizeof s);
            if (!cJSON_IsNumber(tag) || tag->valuedouble != (double)(int32_t)tag->valuedouble)
                bad(m, "UNKNOWN_TAG", "no tag %s in tags.json", s);
            else if (!cJSON_IsBool(v) && !cJSON_IsNumber(v))
                bad(m, "VALUE", "value must be true, false or a number");
            else {
                m->cmd.tag = (int32_t)tag->valuedouble;
                m->cmd.is_bool = (uint8_t)cJSON_IsBool(v);
                m->cmd.value = cJSON_IsBool(v) ? (cJSON_IsTrue(v) ? 1.0 : 0.0) : v->valuedouble;
            }
            break;
        }
        default: break;
        }
    }
    cJSON_Delete(root);
    return m->kind;
}
void msg_free(Msg *m)
{
    cJSON_Delete(m->rt);
    m->rt = NULL;
}

/* ---------------------------------------------------------------- encode: what the studio receives */
char *msg_pong(const char *version, uint32_t cycle_us, uint32_t cycle_max_us)
{
    Buf b = {0};
    int rc = buf_str(&b, "{\"t\":\"pong\",\"version\":");
    rc |= json_esc(&b, version);
    rc |= buf_fmt(&b, ",\"cycle_us\":%u,\"cycle_max_us\":%u}", cycle_us, cycle_max_us);
    return buf_done(&b, rc);
}
char *msg_res(const Ev *e)
{
    Buf b = {0};
    int rc = buf_fmt(&b, "{\"t\":\"res\",\"id\":%d,\"ok\":%s", (int)e->id, e->ok ? "true" : "false");
    if (!e->ok) {
        rc |= buf_str(&b, ",\"err\":");
        rc |= json_esc(&b, e->err);
        rc |= buf_str(&b, ",\"msg\":");
        rc |= json_esc(&b, e->msg);
    } else if (e->crc[0]) {
        rc |= buf_str(&b, ",\"crc\":");
        rc |= json_esc(&b, e->crc);
    }
    rc |= buf_str(&b, "}");
    return buf_done(&b, rc);
}
char *msg_machine(uint64_t ts, uint8_t state, uint8_t mode, const char *prog)
{
    Buf b = {0};
    int rc = buf_fmt(&b, "{\"t\":\"evt\",\"ev\":\"machine\",\"ts\":%llu,\"state\":\"%s\",\"mode\":\"%s\",\"prog\":", (unsigned long long)ts,
                     pack_state_name((PackState)state), pack_mode_name((PackMode)mode));
    rc |= prog && prog[0] ? json_esc(&b, prog) : buf_str(&b, "null");
    rc |= buf_str(&b, "}");
    return buf_done(&b, rc);
}
static const char *const ACT_NAMES[] = {"raise", "ack", "clear"};
char *msg_alarm(uint64_t ts, const Ev *e, const char *time)
{
    Buf b = {0};
    int rc = buf_fmt(&b, "{\"t\":\"evt\",\"ts\":%llu,\"ev\":\"alarm\",\"act\":\"%s\",\"code\":", (unsigned long long)ts, ACT_NAMES[e->act % 3]);
    rc |= json_esc(&b, e->code);
    if (e->act == AL_RAISE) {
        rc |= buf_str(&b, ",\"text\":");
        rc |= json_esc(&b, e->text ? e->text : e->code);
        rc |= buf_fmt(&b, ",\"priority\":%u", e->priority ? e->priority : 3u);
    }
    rc |= buf_str(&b, ",\"time\":");
    rc |= json_esc(&b, time);
    if (e->act == AL_ACK) {
        rc |= buf_str(&b, ",\"by\":");
        rc |= json_esc(&b, e->by);
    }
    rc |= buf_str(&b, "}");
    return buf_done(&b, rc);
}
char *msg_alarms(uint64_t ts, const AlarmList *l)
{
    Buf b = {0};
    int rc = buf_fmt(&b, "{\"t\":\"evt\",\"ts\":%llu,\"ev\":\"alarms\",\"list\":[", (unsigned long long)ts);
    for (uint16_t i = 0; i < l->n; i++) {
        const AlarmEntry *a = &l->a[i];
        rc |= buf_str(&b, i ? ",{\"code\":" : "{\"code\":");
        rc |= json_esc(&b, a->code);
        rc |= buf_str(&b, ",\"text\":");
        rc |= json_esc(&b, a->text ? a->text : a->code);
        rc |= buf_fmt(&b, ",\"priority\":%u,\"time\":", a->priority);
        rc |= json_esc(&b, a->time);
        rc |= buf_fmt(&b, ",\"acked\":%s,\"active\":%s}", a->acked ? "true" : "false", a->active ? "true" : "false");
    }
    rc |= buf_str(&b, "]}");
    return buf_done(&b, rc);
}
static int has_value(const Tag *t) { return t->dtype == D_BOOL || t->dtype == D_INT || t->dtype == D_DINT || t->dtype == D_REAL; }
char *msg_state(uint32_t seq, const TagDB *db, const Value *v, const Value *prev)
{
    Buf b = {0};
    int rc = buf_fmt(&b, "{\"t\":\"state\",\"seq\":%u,\"v\":{", seq), first = 1;
    for (uint16_t i = 0; i < db->n && !rc; i++) {
        const Tag *t = &db->t[i];
        if (!has_value(t) || (prev && !memcmp(&v[i], &prev[i], sizeof v[i]))) continue;
        rc |= buf_fmt(&b, first ? "\"%u\":" : ",\"%u\":", i);
        first = 0;
        if (t->dtype == D_BOOL)
            rc |= buf_str(&b, v[i].b ? "true" : "false");
        else if (t->dtype == D_REAL)
            rc |= buf_fmt(&b, "%.7g", (double)v[i].f);
        else
            rc |= buf_fmt(&b, "%d", (int)v[i].i);
    }
    rc |= buf_str(&b, "},\"pc\":{}}"); /* pc per flow: the flow engine, step 37 */
    return buf_done(&b, rc);
}

/* ---------------------------------------------------------------- the server */
#define CLIENT_MAX 8
typedef struct Client {
    struct mg_connection *conn;
    uint32_t id;
} Client;
struct Comm {
    CommConf c;
    struct mg_context *ctx;
    OsMutex lock; /* clients, the mirror, sending, the command queue's producer side */
    Client cl[CLIENT_MAX];
    uint32_t next_id, n_cl;
    /* what the studio was last told — a new connection gets this first */
    uint8_t state, mode;
    char prog[9];
    AlarmList alarms;
    Value *last; /* tag values in the last state frame */
    uint32_t seq;
    uint64_t next_state_us;
};

static void send_conn(struct mg_connection *conn, char *text) /* frees text */
{
    if (!text) return;
    mg_websocket_write(conn, MG_WEBSOCKET_OPCODE_TEXT, text, strlen(text));
    free(text);
}
static void broadcast(Comm *c, char *text) /* under c->lock; frees text */
{
    if (!text) return;
    for (int i = 0; i < CLIENT_MAX; i++)
        if (c->cl[i].conn) mg_websocket_write(c->cl[i].conn, MG_WEBSOCKET_OPCODE_TEXT, text, strlen(text));
    free(text);
}
static Client *client_of(Comm *c, const struct mg_connection *conn)
{
    for (int i = 0; i < CLIENT_MAX; i++)
        if (c->cl[i].conn == conn) return &c->cl[i];
    return NULL;
}

static int on_connect(const struct mg_connection *conn, void *user)
{
    Comm *c = (Comm *)user;
    (void)conn;
    os_mutex_lock(&c->lock);
    int full = c->n_cl >= CLIENT_MAX;
    os_mutex_unlock(&c->lock);
    if (full) c->c.log("link: refused a connection (already %d clients)", CLIENT_MAX);
    return full; /* 0 = accept */
}
static void on_ready(struct mg_connection *conn, void *user)
{
    Comm *c = (Comm *)user;
    os_mutex_lock(&c->lock);
    for (int i = 0; i < CLIENT_MAX; i++)
        if (!c->cl[i].conn) {
            c->cl[i].conn = conn;
            c->cl[i].id = ++c->next_id;
            c->n_cl++;
            break;
        }
    uint64_t ts = os_wall_ms();
    send_conn(conn, msg_state(++c->seq, c->c.db, c->last, NULL)); /* as the mock: state, machine, alarms */
    send_conn(conn, msg_machine(ts, c->state, c->mode, c->prog));
    send_conn(conn, msg_alarms(ts, &c->alarms));
    uint32_t n = c->n_cl;
    os_mutex_unlock(&c->lock);
    c->c.log("link: studio connected (%u connected)", n);
}
static void on_close(const struct mg_connection *conn, void *user)
{
    Comm *c = (Comm *)user;
    os_mutex_lock(&c->lock);
    Client *k = client_of(c, conn);
    if (k) {
        k->conn = NULL;
        c->n_cl--;
    }
    uint32_t n = c->n_cl;
    os_mutex_unlock(&c->lock);
    c->c.log("link: studio disconnected (%u connected)", n);
}
static void answer(Comm *c, struct mg_connection *conn, int32_t id, const char *err, const char *why)
{
    Ev e;
    memset(&e, 0, sizeof e);
    e.id = id;
    snprintf(e.err, sizeof e.err, "%s", err);
    snprintf(e.msg, sizeof e.msg, "%s", why);
    os_mutex_lock(&c->lock);
    send_conn(conn, msg_res(&e));
    os_mutex_unlock(&c->lock);
}
static int on_data(struct mg_connection *conn, int bits, char *data, size_t len, void *user)
{
    Comm *c = (Comm *)user;
    int opcode = bits & 0x0f;
    if (opcode == MG_WEBSOCKET_OPCODE_CONNECTION_CLOSE) return 0;
    if (opcode != MG_WEBSOCKET_OPCODE_TEXT) return 1;
    Msg m;
    switch (msg_decode(data, len, &m)) {
    case MSG_PING: {
        char *p = msg_pong(c->c.version, c->c.cycle_us, os_atomic_load(c->c.cycle_max_us));
        os_mutex_lock(&c->lock);
        send_conn(conn, p);
        os_mutex_unlock(&c->lock);
        break;
    }
    case MSG_BAD_CMD: answer(c, conn, m.cmd.id, m.err, m.why); break;
    case MSG_CMD: {
        if (m.cmd.op == OP_DOWNLOAD) { /* the heavy part (parse, CRC) here, not in the RT cycle */
            RtProg p;
            char code[8];
            Err e = {""};
            if (prog_verify(m.rt, &p, code, &e)) {
                answer(c, conn, m.cmd.id, code, e.msg);
                break;
            }
            if (!(m.cmd.prog = (RtProg *)malloc(sizeof p))) {
                answer(c, conn, m.cmd.id, "MEMORY", "out of memory");
                break;
            }
            *m.cmd.prog = p;
            c->c.log("download: program %s, %u flow%s, %u step%s (tags_crc %s)", p.crc, p.n_flows, p.n_flows == 1 ? "" : "s", p.n_steps,
                     p.n_steps == 1 ? "" : "s", p.tags_crc);
        }
        os_mutex_lock(&c->lock);
        Client *k = client_of(c, conn);
        m.cmd.client = k ? k->id : 0;
        int full = cmdq_push(c->c.cmdq, &m.cmd);
        os_mutex_unlock(&c->lock);
        if (full) {
            free(m.cmd.prog);
            answer(c, conn, m.cmd.id, "BUSY", "command queue full");
        } else if (m.cmd.op != OP_DOWNLOAD)
            c->c.log("cmd %s%s%s", OP_NAMES[m.cmd.op], m.cmd.op == OP_ACK ? " " : "", m.cmd.op == OP_ACK ? m.cmd.code : "");
        break;
    }
    default: break;
    }
    msg_free(&m);
    return 1;
}

Comm *comm_start(const CommConf *conf, Err *e)
{
    Comm *c = (Comm *)calloc(1, sizeof *c);
    if (!c) {
        err_set(e, 1, "out of memory");
        return NULL;
    }
    c->c = *conf;
    c->state = PS_STOPPED;
    c->mode = PM_AUTO;
    c->last = (Value *)calloc(conf->db->n ? conf->db->n : 1u, sizeof(Value));
    if (!c->last || os_mutex_init(&c->lock)) {
        free(c->last);
        free(c);
        err_set(e, 1, "out of memory");
        return NULL;
    }
    memcpy(c->last, vtri_read(conf->values), sizeof(Value) * conf->db->n);
    char port[32];
    snprintf(port, sizeof port, "127.0.0.1:%u", conf->port); /* only this PC (design: remote access later, with a token) */
    const char *opts[] = {"listening_ports", port, "num_threads", "16", "websocket_timeout_ms", "3600000", "enable_websocket_ping_pong", "no", NULL};
    struct mg_callbacks cb;
    memset(&cb, 0, sizeof cb);
    mg_init_library(0);
    struct mg_init_data init = {&cb, c, opts};
    struct mg_error_data err;
    char text[256] = "";
    memset(&err, 0, sizeof err);
    err.text = text;
    err.text_buffer_size = sizeof text;
    c->ctx = mg_start2(&init, &err);
    if (!c->ctx) {
        err_set(e, 6, "WebSocket server: cannot listen on %s (%s) — is another runtime or the mock running?", port, text[0] ? text : "unknown");
        os_mutex_free(&c->lock);
        free(c->last);
        free(c);
        mg_exit_library();
        return NULL;
    }
    mg_set_websocket_handler(c->ctx, "/", on_connect, on_ready, on_data, on_close, c);
    return c;
}

void comm_pump(Comm *c)
{
    Ev e;
    while (!evr_pop(c->c.events, &e)) {
        uint64_t ts = os_wall_ms();
        char time[9];
        os_clock_text(ts, time);
        os_mutex_lock(&c->lock);
        switch ((EvType)e.type) {
        case EV_RES:
            for (int i = 0; i < CLIENT_MAX; i++)
                if (c->cl[i].conn && c->cl[i].id == e.client) send_conn(c->cl[i].conn, msg_res(&e));
            break;
        case EV_MACHINE:
            c->state = e.state;
            c->mode = e.mode;
            memcpy(c->prog, e.prog, 9);
            broadcast(c, msg_machine(ts, e.state, e.mode, e.prog));
            break;
        case EV_ALARM:
            alarm_apply(&c->alarms, (AlarmAct)e.act, e.code, e.text, e.priority, time);
            broadcast(c, msg_alarm(ts, &e, time));
            break;
        case EV_FREE: break;
        }
        os_mutex_unlock(&c->lock);
        if (e.type == EV_MACHINE)
            c->c.log("machine %s · %s%s%s", pack_state_name((PackState)e.state), pack_mode_name((PackMode)e.mode), e.prog[0] ? " · program " : "", e.prog);
        else if (e.type == EV_ALARM)
            c->c.log("alarm %s %s%s%s", ACT_NAMES[e.act % 3], e.code, e.by[0] ? " by " : "", e.by);
        else if (e.type == EV_RES && !e.ok)
            c->c.log("refused: %s %s", e.err, e.msg);
        else if (e.type == EV_RES && e.crc[0])
            c->c.log("program %s loaded", e.crc);
        free(e.free_me);
    }
    uint64_t now = os_now_us();
    if (now < c->next_state_us) return;
    c->next_state_us = now + 50000u; /* 20 Hz */
    const Value *v = vtri_read(c->c.values);
    if (!memcmp(v, c->last, sizeof(Value) * c->c.db->n)) return; /* nothing changed: no frame */
    char *text = msg_state(c->seq + 1, c->c.db, v, c->last);
    os_mutex_lock(&c->lock);
    c->seq++;
    memcpy(c->last, v, sizeof(Value) * c->c.db->n);
    broadcast(c, text);
    os_mutex_unlock(&c->lock);
}

uint32_t comm_clients(const Comm *c) { return c ? c->n_cl : 0; }

void comm_stop(Comm *c)
{
    if (!c) return;
    mg_stop(c->ctx);
    mg_exit_library();
    os_mutex_free(&c->lock);
    free(c->last);
    free(c);
}

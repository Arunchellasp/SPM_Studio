/* feat — the runtime's features (11c layer 4): I/O mapping, cycle statistics, the machine (PackML, alarms),
 * and the studio link (step 36: WebSocket server, command queue, event ring, state buffer). Flows: step 37. */
#ifndef SPM_FEAT_INC_H
#define SPM_FEAT_INC_H

#include <stdint.h>
#include "../drv/card.h"

/* ---------------------------------------------------------------- I/O map: tags ↔ process image */
typedef struct IoMap {
    uint16_t *in, *out; /* tag ids of DI + AI, of DO + AO — so the cycle never scans all tags */
    uint16_t n_in, n_out;
} IoMap;
int io_map_bind(TagDB *db, Card *c, Arena *a, IoMap *m, Err *e);
void io_read_inputs(TagDB *db, const Card *c, const IoMap *m, uint32_t now_ms);
void io_write_outputs(const TagDB *db, Card *c, const IoMap *m);
void io_all_safe(TagDB *db, Card *c, const IoMap *m); /* outputs off / 0 (on stop) */

/* ---------------------------------------------------------------- cycle statistics (design 5b: 'jitter + max time → UI') */
#define JIT_BUCKETS 6 /* ≤ 10, ≤ 50, ≤ 100, ≤ 250, ≤ 500, > 500 µs */
typedef struct CycleWin {
    uint64_t n;
    uint32_t per_min, per_max; /* period between cycle starts, µs */
    uint64_t per_sum;
    uint32_t jit_max;  /* max |period − nominal| */
    uint32_t late_max; /* max start − deadline */
    uint32_t exec_max; /* max time the cycle body took */
    uint64_t overruns; /* body longer than the period */
    uint64_t hist[JIT_BUCKETS];
} CycleWin;
typedef struct CycleStats {
    uint32_t nominal_us;
    uint64_t last_start;
    CycleWin win, total, snap;
    volatile uint32_t snap_req, snap_ready;
} CycleStats;
extern const char *const JIT_LABELS[JIT_BUCKETS];
void stats_init(CycleStats *s, uint32_t nominal_us);
void stats_cycle(CycleStats *s, uint64_t deadline_us, uint64_t start_us, uint64_t end_us); /* in the RT thread */
int stats_take(CycleStats *s, CycleWin *out, uint32_t wait_ms); /* main thread: the window since the last take */
double stats_avg(const CycleWin *w);
int stats_line(const CycleWin *w, char *buf, size_t cap);

/* ================================================================ step 36 · the machine (owned by the RT thread) */
/* PackML — the same table as the studio's shared/packml.ts (Improved design › "a) Machine sequence") */
typedef enum PackState {
    PS_STOPPED, PS_IDLE, PS_EXECUTE, PS_COMPLETE, PS_HELD, PS_SUSPENDED, PS_ABORTED, /* wait states */
    PS_RESETTING, PS_STARTING, PS_COMPLETING, PS_HOLDING, PS_UNHOLDING, PS_SUSPENDING, PS_UNSUSPENDING,
    PS_STOPPING, PS_ABORTING, PS_CLEARING, /* acting states: finish by themselves after PACK_ACTING_MS */
    PS_COUNT
} PackState;
typedef enum PackCmd { PC_START, PC_HOLD, PC_STOP, PC_RESET } PackCmd;
typedef enum PackMode { PM_AUTO, PM_MANUAL, PM_MAINTENANCE, PM_COUNT } PackMode;
#define PACK_ACTING_MS 800
const char *pack_state_name(PackState s);
const char *pack_mode_name(PackMode m);
int pack_mode_parse(const char *s); /* -1 = unknown */
int pack_is_acting(PackState s);
PackState pack_settle(PackState s); /* acting → the wait state it leads to */
/* 0 = ok (next set); else the reason, word for word as packml.ts says it */
int pack_command(PackState s, PackCmd c, PackState *next, char *reason, size_t cap);
int pack_abort(PackState s, PackState *next);
int pack_mode_ok(PackState s, char *reason, size_t cap);

/* alarms — the list rule of shared/alarms.ts applyAlarm (raise · ack · clear) */
#define ALARM_MAX 64
typedef enum AlarmAct { AL_RAISE, AL_ACK, AL_CLEAR } AlarmAct;
typedef struct AlarmEntry {
    char code[16];
    const char *text; /* static (the alarm table) */
    uint8_t priority;
    char time[9]; /* hh:mm:ss — stamped on the comm side */
    uint8_t acked, active;
} AlarmEntry;
typedef struct AlarmList {
    AlarmEntry a[ALARM_MAX];
    uint16_t n;
} AlarmList;
typedef struct AlarmDef {
    const char *code, *text;
    uint8_t priority;
} AlarmDef;
const AlarmDef *alarm_def(const char *code); /* the SimCard demo alarms (as the mock's DEMO_ALARMS) */
const AlarmEntry *alarm_find(const AlarmList *l, const char *code);
int alarm_has(const AlarmList *l, const char *code); /* in the list and active */
void alarm_apply(AlarmList *l, AlarmAct act, const char *code, const char *text, uint8_t priority, const char *time);

/* comm → RT: commands (many producers on the comm side under a lock, one consumer: the RT cycle, lock-free) */
typedef enum CmdOp { OP_START, OP_HOLD, OP_STOP, OP_RESET, OP_MODE, OP_ACK, OP_DOWNLOAD, OP_WRITE, OP_COUNT } CmdOp;
typedef struct Cmd {
    uint32_t client; /* who asked (the answer goes back to it) */
    int32_t id;
    uint8_t op, mode;
    char code[16], user[48];
    int32_t tag;
    uint8_t is_bool;
    double value;
    RtProg *prog; /* download: checked on the comm side; the RT cycle only swaps the pointer */
} Cmd;
#define CMDQ_N 256
typedef struct CmdQueue {
    Cmd q[CMDQ_N];
    volatile uint32_t head, tail;
} CmdQueue;
int cmdq_push(CmdQueue *q, const Cmd *c); /* comm side; 1 = full */
int cmdq_pop(CmdQueue *q, Cmd *c);        /* RT side; 0 = got one */

/* RT → comm: events and answers, one producer (RT) and one consumer (the pump). Events are never dropped
 * on purpose: 4096 entries; if it is ever full the event is counted in 'lost' (design 'Comm thread'). */
typedef enum EvType { EV_RES, EV_MACHINE, EV_ALARM, EV_FREE } EvType;
typedef struct Ev {
    uint8_t type;
    uint32_t client; /* EV_RES: to this client only */
    int32_t id;
    uint8_t ok;
    char err[12], msg[200], crc[9];
    uint8_t state, mode;
    char prog[9]; /* "" = no program */
    uint8_t act, priority;
    char code[16], by[48];
    const char *text;
    void *free_me; /* EV_FREE / EV_RES: memory the comm side gives back (an old or refused program) */
} Ev;
#define EVR_N 4096
typedef struct EvRing {
    Ev e[EVR_N];
    volatile uint32_t head, tail;
    uint32_t lost;
} EvRing;
void evr_push(EvRing *r, const Ev *e); /* RT side */
int evr_pop(EvRing *r, Ev *e);         /* comm side; 0 = got one */

/* RT → comm: all tag values, a triple buffer — the RT cycle always has a buffer to write, the comm side always
 * has a complete one to read; nobody waits (the design's 'double buffer', with a spare so neither side blocks) */
typedef struct ValueTriple {
    Value *buf[3];
    uint16_t n;
    volatile uint32_t mid; /* index of the middle buffer | 4 when it holds a newer copy */
    uint32_t back, front;  /* back: RT only · front: comm only */
} ValueTriple;
int vtri_init(ValueTriple *t, uint16_t n, Arena *a);
void vtri_publish(ValueTriple *t, const TagDB *db); /* RT: copy every tag value, then swap */
const Value *vtri_read(ValueTriple *t);            /* comm: the newest complete copy */

typedef struct Machine {
    PackState state;
    PackMode mode;
    uint64_t acting_until; /* µs; 0 = not acting */
    RtProg *prog;
    AlarmList alarms;
    EvRing *out;
    uint8_t demo;                                  /* SimCard alarm demo (config sim.demo_alarms) */
    uint64_t t_w0310, t_w0310_clear, t_e1202; /* demo timers, µs; 0 = off */
} Machine;
void machine_init(Machine *m, EvRing *out, int demo);
void machine_cmd(Machine *m, const Cmd *c, uint64_t now_us, TagDB *db, Card *card); /* RT: one command → events + answer */
void machine_tick(Machine *m, uint64_t now_us);                                    /* RT: acting states, demo timers */

/* ================================================================ step 36 · messages (schemas/message.schema.json) */
typedef enum MsgKind { MSG_IGNORE, MSG_PING, MSG_CMD, MSG_BAD_CMD } MsgKind;
typedef struct Msg {
    MsgKind kind;
    Cmd cmd;
    char op[24];
    char err[12], why[200]; /* MSG_BAD_CMD: the answer, decided on the comm side */
    cJSON *rt;              /* download: the program (owned by the Msg) */
} Msg;
MsgKind msg_decode(const char *text, size_t n, Msg *m);
void msg_free(Msg *m);
/* encoders: the same JSON as the mock runtime sends; return a malloc'd string */
char *msg_pong(const char *version, uint32_t cycle_us, uint32_t cycle_max_us);
char *msg_res(const Ev *e);
char *msg_machine(uint64_t ts, uint8_t state, uint8_t mode, const char *prog);
char *msg_alarm(uint64_t ts, const Ev *e, const char *time);
char *msg_alarms(uint64_t ts, const AlarmList *l);
/* state frame: changed = NULL → every tag; else only tags whose value differs from prev */
char *msg_state(uint32_t seq, const TagDB *db, const Value *v, const Value *prev);

/* ================================================================ step 36 · the WebSocket server (civetweb) */
typedef void (*CommLog)(const char *fmt, ...);
typedef struct Comm Comm;
typedef struct CommConf {
    uint16_t port;
    const char *version;
    uint32_t cycle_us;
    volatile uint32_t *cycle_max_us; /* the RT cycle's longest period in the last second */
    const TagDB *db;
    CmdQueue *cmdq;
    EvRing *events;
    ValueTriple *values;
    CommLog log;
} CommConf;
Comm *comm_start(const CommConf *c, Err *e); /* listens on 127.0.0.1:port */
void comm_pump(Comm *c);                     /* main thread, every few ms: events out, state frames at 20 Hz */
void comm_stop(Comm *c);
uint32_t comm_clients(const Comm *c);

#endif

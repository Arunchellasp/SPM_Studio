/* data — what the runtime loads: config.json and tags.json (Software implementation › 3d, 5a, 5c; 11c layer 3). */
#ifndef SPM_DATA_INC_H
#define SPM_DATA_INC_H

#include <stdint.h>
#include "../base/base_inc.h"
#include "../../third_party/cjson/cJSON.h"

/* ---------------------------------------------------------------- config.json */
#define SPM_PATH_MAX 512
typedef struct RtConfig {
    char dir[SPM_PATH_MAX];          /* folder of config.json: other paths are relative to it */
    char card[16];                   /* "sim" (gts, adv, delta: later) */
    uint32_t cycle_us;               /* 250 … 10000, default 1000 */
    uint32_t spin_us;                /* last part of each wait on the clock, default 200 */
    int cpu;                         /* pin the RT thread to this core, -1 = no */
    char tags_path[SPM_PATH_MAX];    /* default tags.json */
    char program_path[SPM_PATH_MAX]; /* default program.rt.json (loaded from step 37) */
    char log_path[SPM_PATH_MAX];     /* default logs/spm_rt.log */
    uint16_t ws_port;                /* WebSocket server for the studio, 127.0.0.1 only, default 7600 */
    uint32_t stats_s;                /* a stats line every N s, default 10 */
    uint32_t sim_cyl_ms;             /* SimCard: cylinder sensors follow the valve after N ms, default 200 */
    uint8_t sim_demo_alarms;         /* SimCard: the mock runtime's alarm demo (W0310, E1202), default off */
} RtConfig;
int cfg_load(const char *path, RtConfig *cfg, Err *e);

/* ---------------------------------------------------------------- tags.json → TagDB (design 3d) */
typedef enum { K_DI, K_DO, K_AI, K_AO, K_AXIS, K_POINT, K_REG, K_TIMER, K_COUNTER, K_ALARM, K_RECIPE, K_UDT, K__N } TagKind;
typedef enum { D_BOOL, D_INT, D_DINT, D_REAL, D_STRING, D_STRUCT, D__N } DType;
typedef union {
    int32_t i;
    float f;
    uint8_t b;
} Value;
enum { F_INVERT = 1, F_RETAIN = 2, F_LOG_CHANGE = 4, F_FORCED = 8 };
enum { BUS_NONE = 0, BUS_ECAT = 1, BUS_SIM = 2 };
typedef struct IoAddr {
    uint8_t bus;
    uint16_t slave;
    int16_t ch; /* -1 = the whole slave (an axis) */
} IoAddr;
typedef struct UdtField {
    const char *name;
    uint16_t tag;
} UdtField;
/* step 37: what a move and an alarm need from their tags */
typedef struct AxisDef {
    float vmax, acc, soft_min, soft_max; /* engineering units (mm, mm/s); soft_min == soft_max: no limits */
} AxisDef;
#define POINT_AXES 4
typedef struct PointDef {
    uint8_t n;
    uint16_t axis[POINT_AXES];       /* tag ids of the axes, in the order of "values" */
    float val[POINT_AXES];
    const char *axis_name[POINT_AXES]; /* until pass 2 resolves them */
} PointDef;
typedef enum AlarmReaction { AR_NONE, AR_PAUSE, AR_STOP, AR_ABORT } AlarmReaction;
typedef struct AlarmTagDef {
    char code[16];    /* "A301" from code 301 */
    const char *text;
    uint8_t priority; /* severity 1 … 3 */
    uint8_t reaction; /* AlarmReaction */
} AlarmTagDef;

typedef struct Tag {
    uint16_t id; /* index in the array = what compiled flows use */
    TagKind kind;
    DType dtype;
    uint16_t flags; /* INVERT | RETAIN | LOG_CHANGE | FORCED */
    IoAddr addr;
    float k, o;    /* scale: eng = raw * k + o */
    Value v, prev; /* current and previous cycle value */
    uint32_t t_change;
    int32_t io; /* index in the card's process image (io_map_bind); -1 = not I/O */
    const char *name; /* names only at load and in messages — the cycle uses ids */
    const char *udt_type;
    UdtField *fields;
    uint8_t n_fields;
    AxisDef *axis;      /* AXIS tags */
    PointDef *point;    /* POINT tags */
    AlarmTagDef *alarm; /* ALARM tags */
} Tag;
typedef struct TagDB {
    Tag *t;
    uint16_t n;
    uint32_t *hash; /* open addressing: name → id + 1 (0 = empty) */
    uint32_t hcap;
    uint32_t crc; /* tags_crc as the studio's compiler computes it (LF line ends) */
} TagDB;
int tagdb_load(const char *path, Arena *a, TagDB *db, Err *e);
int tagdb_find(const TagDB *db, const char *name); /* id, or -1 */
const char *kind_name(TagKind k);

/* ---------------------------------------------------------------- a downloaded program (prog.c) */
typedef struct RtProg {
    char crc[9], tags_crc[9];
    uint16_t n_flows;
    uint32_t n_steps;
} RtProg;
/* the file's canonical text (shared/compile.ts formatRtFile) with "crc" = crc; malloc'd, NULL when out of memory */
char *rt_format(const cJSON *rt, const char *crc);
/* shared/compile.ts verifyRt: 0 = ok (out filled); else code = "SCHEMA" or "CRC" and the reason in e */
int prog_verify(const cJSON *rt, RtProg *out, char code[8], Err *e);

/* ---------------------------------------------------------------- step 37: the step table the flow engine runs (5c) */
#define FLOW_MAX 32
#define RPN_STACK 32
#define NO_TAG 0xFFFFu
typedef enum StepOp { SO_START, SO_END, SO_WAIT_DI, SO_SET_DO, SO_MOVE_ABS, SO_DELAY, SO_IF, SO__N } StepOp;
typedef enum RpnKind { RK_TAG, RK_K, RK_NOT, RK_NEG, RK_AND, RK_OR, RK_EQ, RK_NE, RK_LT, RK_LE, RK_GT, RK_GE, RK_ADD, RK_SUB, RK_MUL, RK_DIV, RK__N } RpnKind;
typedef struct RpnTok {
    uint8_t k;
    uint16_t tag;
    double v;
} RpnTok;
typedef struct Step {
    uint8_t op, val, spd;
    uint16_t next, yes, no;
    uint16_t tag, alarm, axis, point; /* tag ids; alarm NO_TAG = none */
    uint32_t tmo, ms;
    float target;     /* MOVE_ABS: the point's value for this axis (resolved at load) */
    uint32_t rpn_at;  /* IF: first token in Prog.rpn */
    uint16_t rpn_n;
    const char *src;  /* editor node id, for messages */
} Step;
typedef struct FlowDef {
    const char *name;
    uint32_t first; /* index of its step 0 in Prog.steps */
    uint16_t n;
} FlowDef;
typedef struct Prog { /* one malloc'd block: free(prog) frees it all */
    RtProg meta;
    uint16_t n_flows;
    FlowDef flow[FLOW_MAX];
    Step *steps;
    RpnTok *rpn;
} Prog;
extern const char *const STEP_OP_NAMES[SO__N];
/* checked program.rt.json → step table, against the loaded tags (ids, kinds, limits, RPN depth).
 * Done once at download on the comm side, so the RT cycle never meets a bad step.
 * 0 = ok; else code "TAGS" (built for other tags) or "PROGRAM" and the reason in e. */
int prog_build(const cJSON *rt, const TagDB *db, Prog **out, char code[8], Err *e);
/* RPN on the tag values (the studio's evalRpn): the step table was checked, so this cannot fail */
double rpn_eval(const RpnTok *t, uint16_t n, const TagDB *db);
double tag_num(const Tag *t); /* BOOL → 0 / 1, INT / DINT, REAL */

#endif

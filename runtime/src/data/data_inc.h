/* data — what the runtime loads: config.json and tags.json (Software implementation › 3d, 5a, 5c; 11c layer 3). */
#ifndef SPM_DATA_INC_H
#define SPM_DATA_INC_H

#include <stdint.h>
#include "../base/base_inc.h"

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
    uint16_t ws_port;                /* default 7600 (served from step 36) */
    uint32_t stats_s;                /* a stats line every N s, default 10 */
    uint32_t sim_cyl_ms;             /* SimCard: cylinder sensors follow the valve after N ms, default 200 */
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

#endif

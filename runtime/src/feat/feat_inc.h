/* feat — the runtime's features: I/O mapping, the cycle, its statistics (11c layer 4). Flows, alarms, WebSocket: later steps. */
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

#endif

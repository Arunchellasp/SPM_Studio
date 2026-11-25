/* os — what differs between Windows and Linux: clock, files, threads, the real-time timer (11c, layer 2). */
#ifndef SPM_OS_INC_H
#define SPM_OS_INC_H

#include <stdint.h>
#include "../base/base_inc.h"

uint64_t os_now_us(void); /* monotonic, microseconds */
void os_sleep_ms(uint32_t ms);

/* whole file → arena, 0-terminated (only at load time) */
int os_read_file(const char *path, Arena *a, char **text, size_t *len, Err *e);
/* "D:/x/config.json" → "D:/x" ; relative paths in config.json are relative to its folder */
void os_dir_of(const char *path, char *out, size_t cap);
void os_join(const char *dir, const char *rel, char *out, size_t cap);
int os_mkdirs_for(const char *file_path); /* create the folders a file will be written in */

/* 32-bit atomics between the RT thread and the main thread (no C11 <stdatomic.h>: MSVC) */
uint32_t os_atomic_load(volatile uint32_t *p);
void os_atomic_store(volatile uint32_t *p, uint32_t v);

/* Ctrl+C / SIGTERM / console close → os_shutdown_requested() */
void os_shutdown_install(void);
int os_shutdown_requested(void);

/*
 * The real-time thread: calls cycle(user) every period_us at the highest priority the OS gives us.
 * It sleeps on a high-resolution timer until spin_us before the deadline, then waits the rest on the clock
 * (a sleep alone wakes up too late on Windows). Deadlines stay on a fixed grid; one that has already passed when
 * a cycle ends is skipped and counted in missed — the machine never "catches up" with a burst of cycles.
 */
typedef void (*OsCycleFn)(void *user, uint64_t deadline_us, uint64_t start_us);
typedef struct OsRt {
    uint32_t period_us, spin_us;
    int cpu; /* pin to this core; -1 = no pinning */
    OsCycleFn cycle;
    void *user;
    volatile uint32_t stop;
    uint32_t missed;
    char prio_note[160]; /* what priority we got (or why not) */
    void *thread;
} OsRt;
int os_rt_start(OsRt *rt, Err *e);
void os_rt_stop(OsRt *rt);

#endif

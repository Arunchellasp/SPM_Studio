#ifdef _WIN32
#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <direct.h>
#include <mmsystem.h>
#else
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <errno.h>
#include <pthread.h>
#include <sched.h>
#include <signal.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "os_inc.h"

/* ---------------------------------------------------------------- clock */
#ifdef _WIN32
static LARGE_INTEGER g_qpf;
uint64_t os_now_us(void)
{
    LARGE_INTEGER c;
    if (!g_qpf.QuadPart) QueryPerformanceFrequency(&g_qpf);
    QueryPerformanceCounter(&c);
    return (uint64_t)(c.QuadPart / g_qpf.QuadPart) * 1000000u + (uint64_t)(c.QuadPart % g_qpf.QuadPart) * 1000000u / (uint64_t)g_qpf.QuadPart;
}
void os_sleep_ms(uint32_t ms)
{
    Sleep(ms);
}
#else
uint64_t os_now_us(void)
{
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (uint64_t)t.tv_sec * 1000000u + (uint64_t)t.tv_nsec / 1000u;
}
void os_sleep_ms(uint32_t ms)
{
    struct timespec t = {(time_t)(ms / 1000u), (long)(ms % 1000u) * 1000000L};
    while (nanosleep(&t, &t) != 0 && errno == EINTR) {
    }
}
#endif

/* ---------------------------------------------------------------- files */
int os_read_file(const char *path, Arena *a, char **text, size_t *len, Err *e)
{
    FILE *f = fopen(path, "rb");
    if (!f) return err_set(e, 1, "cannot open %s", path);
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (n < 0) {
        fclose(f);
        return err_set(e, 1, "cannot read %s", path);
    }
    char *buf = (char *)arena_push(a, (size_t)n + 1);
    if (!buf) {
        fclose(f);
        return err_set(e, 1, "%s is too big (%ld bytes) for the load arena", path, n);
    }
    size_t got = fread(buf, 1, (size_t)n, f);
    fclose(f);
    if (got != (size_t)n) return err_set(e, 1, "cannot read %s", path);
    buf[n] = 0;
    *text = buf;
    if (len) *len = (size_t)n;
    return 0;
}

static int is_sep(char c)
{
    return c == '/' || c == '\\';
}

void os_dir_of(const char *path, char *out, size_t cap)
{
    size_t n = strlen(path);
    while (n > 0 && !is_sep(path[n - 1])) n--;
    if (n == 0) {
        snprintf(out, cap, ".");
        return;
    }
    if (n > 1) n--; /* drop the separator, keep "/" */
    snprintf(out, cap, "%.*s", (int)n, path);
}

void os_join(const char *dir, const char *rel, char *out, size_t cap)
{
    int absolute = is_sep(rel[0]) || (rel[0] && rel[1] == ':');
    if (absolute || !dir[0] || str_eq(dir, "."))
        snprintf(out, cap, "%s", rel);
    else
        snprintf(out, cap, "%s/%s", dir, rel);
}

int os_mkdirs_for(const char *file_path)
{
    char p[512];
    snprintf(p, sizeof p, "%s", file_path);
    for (char *c = p + 1; *c; c++) {
        if (!is_sep(*c) || c[-1] == ':') continue;
        char keep = *c;
        *c = 0;
#ifdef _WIN32
        _mkdir(p);
#else
        mkdir(p, 0755);
#endif
        *c = keep;
    }
    return 0;
}

/* ---------------------------------------------------------------- atomics */
uint32_t os_atomic_load(volatile uint32_t *p)
{
#ifdef _WIN32
    return (uint32_t)InterlockedCompareExchange((volatile LONG *)p, 0, 0);
#else
    return __atomic_load_n(p, __ATOMIC_SEQ_CST);
#endif
}
void os_atomic_store(volatile uint32_t *p, uint32_t v)
{
#ifdef _WIN32
    InterlockedExchange((volatile LONG *)p, (LONG)v);
#else
    __atomic_store_n(p, v, __ATOMIC_SEQ_CST);
#endif
}
uint32_t os_atomic_xchg(volatile uint32_t *p, uint32_t v)
{
#ifdef _WIN32
    return (uint32_t)InterlockedExchange((volatile LONG *)p, (LONG)v);
#else
    return __atomic_exchange_n(p, v, __ATOMIC_SEQ_CST);
#endif
}

/* ---------------------------------------------------------------- shutdown */
static volatile uint32_t g_shutdown;
/* ---------------------------------------------------------------- wall clock, mutex (comm side) */
#ifdef _WIN32
uint64_t os_wall_ms(void)
{
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    uint64_t t = ((uint64_t)ft.dwHighDateTime << 32) | ft.dwLowDateTime; /* 100 ns since 1601 */
    return t / 10000u - 11644473600000ull;
}
void os_clock_text(uint64_t wall_ms, char out[9])
{
    time_t s = (time_t)(wall_ms / 1000u);
    struct tm tm;
    localtime_s(&tm, &s);
    snprintf(out, 9, "%02d:%02d:%02d", tm.tm_hour, tm.tm_min, tm.tm_sec);
}
int os_mutex_init(OsMutex *m)
{
    CRITICAL_SECTION *cs = (CRITICAL_SECTION *)malloc(sizeof *cs);
    if (!cs) return 1;
    InitializeCriticalSection(cs);
    m->h = cs;
    return 0;
}
void os_mutex_lock(OsMutex *m) { EnterCriticalSection((CRITICAL_SECTION *)m->h); }
void os_mutex_unlock(OsMutex *m) { LeaveCriticalSection((CRITICAL_SECTION *)m->h); }
void os_mutex_free(OsMutex *m)
{
    if (!m->h) return;
    DeleteCriticalSection((CRITICAL_SECTION *)m->h);
    free(m->h);
    m->h = NULL;
}
#else
uint64_t os_wall_ms(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (uint64_t)ts.tv_sec * 1000u + (uint64_t)ts.tv_nsec / 1000000u;
}
void os_clock_text(uint64_t wall_ms, char out[9])
{
    time_t s = (time_t)(wall_ms / 1000u);
    struct tm tm;
    localtime_r(&s, &tm);
    snprintf(out, 9, "%02d:%02d:%02d", tm.tm_hour, tm.tm_min, tm.tm_sec);
}
int os_mutex_init(OsMutex *m)
{
    pthread_mutex_t *x = (pthread_mutex_t *)malloc(sizeof *x);
    if (!x) return 1;
    pthread_mutex_init(x, NULL);
    m->h = x;
    return 0;
}
void os_mutex_lock(OsMutex *m) { pthread_mutex_lock((pthread_mutex_t *)m->h); }
void os_mutex_unlock(OsMutex *m) { pthread_mutex_unlock((pthread_mutex_t *)m->h); }
void os_mutex_free(OsMutex *m)
{
    if (!m->h) return;
    pthread_mutex_destroy((pthread_mutex_t *)m->h);
    free(m->h);
    m->h = NULL;
}
#endif

#ifdef _WIN32
static BOOL WINAPI on_ctrl(DWORD type)
{
    (void)type;
    os_atomic_store(&g_shutdown, 1);
    return TRUE;
}
void os_shutdown_install(void)
{
    SetConsoleCtrlHandler(on_ctrl, TRUE);
}
#else
static void on_signal(int s)
{
    (void)s;
    g_shutdown = 1;
}
void os_shutdown_install(void)
{
    signal(SIGINT, on_signal);
    signal(SIGTERM, on_signal);
}
#endif
int os_shutdown_requested(void)
{
    return os_atomic_load(&g_shutdown) != 0;
}

/* ---------------------------------------------------------------- the real-time thread */
static void rt_loop(OsRt *rt, void *timer)
{
    uint64_t next = os_now_us() + rt->period_us;
    while (!os_atomic_load(&rt->stop)) {
        uint64_t now = os_now_us();
        if (next > now + rt->spin_us) {
#ifdef _WIN32
            uint64_t sleep_us = next - now - rt->spin_us;
            LARGE_INTEGER due;
            due.QuadPart = -(LONGLONG)(sleep_us * 10u); /* relative, 100 ns units */
            if (timer && SetWaitableTimer((HANDLE)timer, &due, 0, NULL, NULL, FALSE))
                WaitForSingleObject((HANDLE)timer, INFINITE);
            else
                Sleep((DWORD)(sleep_us / 1000u));
#else
            (void)timer;
            uint64_t wake = next - rt->spin_us;
            struct timespec t = {(time_t)(wake / 1000000u), (long)(wake % 1000000u) * 1000L};
            while (clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &t, NULL) == EINTR) {
            }
#endif
        }
        while ((now = os_now_us()) < next) {
            /* the last spin_us: wait on the clock — a timer alone wakes up too late */
        }
        rt->cycle(rt->user, next, now);
        next += rt->period_us;
        now = os_now_us();
        if (now >= next) { /* already past the next deadline: skip the deadlines that are gone (no catch-up burst), stay on the grid */
            uint64_t skip = (now - next) / rt->period_us + 1u;
            rt->missed += (uint32_t)skip;
            next += skip * rt->period_us;
        }
    }
}

#ifdef _WIN32
#ifndef CREATE_WAITABLE_TIMER_HIGH_RESOLUTION
#define CREATE_WAITABLE_TIMER_HIGH_RESOLUTION 0x00000002
#endif
static DWORD WINAPI rt_thread(LPVOID p)
{
    OsRt *rt = (OsRt *)p;
    /* high-resolution waitable timer (Windows 10 1803+); without it a plain one at 1 ms timer resolution */
    HANDLE timer = CreateWaitableTimerExW(NULL, NULL, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, TIMER_ALL_ACCESS);
    int hires = timer != NULL;
    if (!timer) timer = CreateWaitableTimerExW(NULL, NULL, 0, TIMER_ALL_ACCESS);
    BOOL prio = SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
    if (rt->cpu >= 0) SetThreadAffinityMask(GetCurrentThread(), (DWORD_PTR)1 << rt->cpu);
    snprintf(rt->prio_note, sizeof rt->prio_note, "Windows: process HIGH, thread %s, timer %s, timeBeginPeriod(1)%s",
             prio ? "TIME_CRITICAL" : "normal (TIME_CRITICAL refused)", hires ? "high-resolution" : "standard",
             rt->cpu >= 0 ? ", pinned" : "");
    rt_loop(rt, timer);
    if (timer) CloseHandle(timer);
    return 0;
}
int os_rt_start(OsRt *rt, Err *e)
{
    timeBeginPeriod(1);
    SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
    rt->stop = 0;
    rt->missed = 0;
    HANDLE h = CreateThread(NULL, 0, rt_thread, rt, 0, NULL);
    if (!h) return err_set(e, 1, "cannot start the RT thread (error %lu)", (unsigned long)GetLastError());
    rt->thread = h;
    return 0;
}
void os_rt_stop(OsRt *rt)
{
    if (!rt->thread) return;
    os_atomic_store(&rt->stop, 1);
    WaitForSingleObject((HANDLE)rt->thread, INFINITE);
    CloseHandle((HANDLE)rt->thread);
    rt->thread = NULL;
    timeEndPeriod(1);
}
#else
static void *rt_thread(void *p)
{
    OsRt *rt = (OsRt *)p;
    struct sched_param sp = {.sched_priority = 80};
    int fifo = pthread_setschedparam(pthread_self(), SCHED_FIFO, &sp) == 0;
    if (rt->cpu >= 0) {
        cpu_set_t set;
        CPU_ZERO(&set);
        CPU_SET(rt->cpu, &set);
        pthread_setaffinity_np(pthread_self(), sizeof set, &set);
    }
    snprintf(rt->prio_note, sizeof rt->prio_note, "Linux: %s, clock_nanosleep absolute%s",
             fifo ? "SCHED_FIFO 80" : "normal priority (SCHED_FIFO needs root or CAP_SYS_NICE)", rt->cpu >= 0 ? ", pinned" : "");
    rt_loop(rt, NULL);
    return NULL;
}
int os_rt_start(OsRt *rt, Err *e)
{
    static pthread_t th;
    mlockall(MCL_CURRENT | MCL_FUTURE); /* no page faults in the cycle; ignored when not allowed */
    rt->stop = 0;
    rt->missed = 0;
    if (pthread_create(&th, NULL, rt_thread, rt) != 0) return err_set(e, 1, "cannot start the RT thread");
    rt->thread = &th;
    return 0;
}
void os_rt_stop(OsRt *rt)
{
    if (!rt->thread) return;
    os_atomic_store(&rt->stop, 1);
    pthread_join(*(pthread_t *)rt->thread, NULL);
    rt->thread = NULL;
}
#endif

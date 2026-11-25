/* base — no dependencies: error text, arena, strings (Software implementation › 11c, layer 1). */
#ifndef SPM_BASE_INC_H
#define SPM_BASE_INC_H

#include <stddef.h>
#include <stdint.h>

/* An error with its reason, filled by the function that failed (0 = ok, else a code). */
typedef struct Err {
    char msg[320];
} Err;
int err_set(Err *e, int code, const char *fmt, ...);

/*
 * Arena: one block taken at load time; everything the runtime keeps (tags, names, program) lives in it.
 * Nothing is allocated in the real-time cycle — the design's rule "no malloc in the RT cycle".
 */
typedef struct Arena {
    uint8_t *base;
    size_t cap, used;
} Arena;
int arena_init(Arena *a, size_t cap);
void *arena_push(Arena *a, size_t size); /* zeroed, 8-byte aligned; NULL when full */
char *arena_strdup(Arena *a, const char *s);
void arena_free(Arena *a);

int str_eq(const char *a, const char *b);
/* CRC-32 (zlib polynomial) — the same as the studio's compiler (shared/compile.ts crc32) */
uint32_t crc32_text(const char *s, size_t n);
/* CRC-32 of a text file read as LF line ends (a file saved on Windows may have CRLF) */
uint32_t crc32_lf(const char *s, size_t n);

#endif

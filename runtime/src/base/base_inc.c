#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "base_inc.h"

int err_set(Err *e, int code, const char *fmt, ...)
{
    if (e) {
        va_list ap;
        va_start(ap, fmt);
        vsnprintf(e->msg, sizeof e->msg, fmt, ap);
        va_end(ap);
    }
    return code;
}

int arena_init(Arena *a, size_t cap)
{
    a->base = (uint8_t *)calloc(1, cap);
    a->cap = a->base ? cap : 0;
    a->used = 0;
    return a->base ? 0 : 1;
}

void *arena_push(Arena *a, size_t size)
{
    size_t at = (a->used + 7u) & ~(size_t)7u;
    if (!a->base || at + size > a->cap) return NULL;
    a->used = at + size;
    memset(a->base + at, 0, size);
    return a->base + at;
}

char *arena_strdup(Arena *a, const char *s)
{
    size_t n = strlen(s) + 1;
    char *p = (char *)arena_push(a, n);
    if (p) memcpy(p, s, n);
    return p;
}

void arena_free(Arena *a)
{
    free(a->base);
    a->base = NULL;
    a->cap = a->used = 0;
}

int str_eq(const char *a, const char *b)
{
    return a && b && strcmp(a, b) == 0;
}

static uint32_t crc_step(uint32_t c, uint8_t b)
{
    c ^= b;
    for (int k = 0; k < 8; k++) c = (c & 1u) ? 0xEDB88320u ^ (c >> 1) : c >> 1;
    return c;
}

uint32_t crc32_text(const char *s, size_t n)
{
    uint32_t c = 0xFFFFFFFFu;
    for (size_t i = 0; i < n; i++) c = crc_step(c, (uint8_t)s[i]);
    return c ^ 0xFFFFFFFFu;
}

uint32_t crc32_lf(const char *s, size_t n)
{
    uint32_t c = 0xFFFFFFFFu;
    for (size_t i = 0; i < n; i++) {
        if (s[i] == '\r' && i + 1 < n && s[i + 1] == '\n') continue; /* CRLF → LF */
        c = crc_step(c, (uint8_t)s[i]);
    }
    return c ^ 0xFFFFFFFFu;
}

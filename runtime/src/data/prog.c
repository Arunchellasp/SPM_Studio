/*
 * data — a downloaded program (program.rt.json, spm.rt/1): the same check as the studio's compiler
 * (shared/compile.ts verifyRt): schema, required keys, and the CRC of the file's canonical text
 * (formatRtFile) with "crc" set to 00000000. Runs on the comm side, never in the RT cycle.
 * Step 37 turns the checked file into the step table the flow engine runs.
 */
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Buf {
    char *p;
    size_t n, cap;
} Buf;

static int buf_put(Buf *b, const char *s, size_t n)
{
    if (b->n + n + 1 > b->cap) {
        size_t cap = b->cap ? b->cap * 2 : 1024;
        while (cap < b->n + n + 1) cap *= 2;
        char *p = (char *)realloc(b->p, cap);
        if (!p) return 1;
        b->p = p;
        b->cap = cap;
    }
    memcpy(b->p + b->n, s, n);
    b->n += n;
    b->p[b->n] = 0;
    return 0;
}
static int buf_str(Buf *b, const char *s) { return buf_put(b, s, strlen(s)); }
static int buf_fmt(Buf *b, const char *fmt, ...)
{
    char tmp[512];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(tmp, sizeof tmp, fmt, ap);
    va_end(ap);
    if (n < 0) return 1;
    if ((size_t)n < sizeof tmp) return buf_put(b, tmp, (size_t)n);
    char *big = (char *)malloc((size_t)n + 1);
    if (!big) return 1;
    va_start(ap, fmt);
    vsnprintf(big, (size_t)n + 1, fmt, ap);
    va_end(ap);
    int rc = buf_put(b, big, (size_t)n);
    free(big);
    return rc;
}
/* one JSON value as JSON.stringify writes it (cJSON unformatted keeps key order and the same escapes) */
static int buf_json(Buf *b, const cJSON *v)
{
    char *s = v ? cJSON_PrintUnformatted(v) : NULL;
    int rc = buf_str(b, s ? s : "undefined");
    if (s) cJSON_free(s);
    return rc;
}

char *rt_format(const cJSON *rt, const char *crc)
{
    Buf b = {0};
    const cJSON *tc = cJSON_GetObjectItemCaseSensitive(rt, "tags_crc");
    const cJSON *flows = cJSON_GetObjectItemCaseSensitive(rt, "flows");
    int rc = buf_fmt(&b, "{\n  \"schema\": \"spm.rt/1\", \"crc\": \"%s\", \"tags_crc\": \"%s\",\n  \"flows\": [", crc,
                     cJSON_IsString(tc) ? tc->valuestring : "");
    int nf = 0;
    for (const cJSON *f = flows ? flows->child : NULL; !rc && f; f = f->next, nf++) {
        const cJSON *auto_ = cJSON_GetObjectItemCaseSensitive(f, "autostart");
        const cJSON *steps = cJSON_GetObjectItemCaseSensitive(f, "steps");
        rc |= buf_str(&b, nf ? ",\n" : "\n");
        rc |= buf_str(&b, "    {\n      \"name\": ");
        rc |= buf_json(&b, cJSON_GetObjectItemCaseSensitive(f, "name"));
        rc |= buf_str(&b, ", \"id\": ");
        rc |= buf_json(&b, cJSON_GetObjectItemCaseSensitive(f, "id"));
        rc |= buf_str(&b, ", \"station\": ");
        rc |= buf_json(&b, cJSON_GetObjectItemCaseSensitive(f, "station"));
        rc |= buf_str(&b, ", \"autostart\": ");
        rc |= buf_str(&b, cJSON_IsTrue(auto_) ? "true" : cJSON_IsFalse(auto_) ? "false" : "undefined");
        rc |= buf_str(&b, ",\n      \"steps\": ");
        if (!steps || !steps->child)
            rc |= buf_str(&b, "[]");
        else {
            rc |= buf_str(&b, "[\n");
            for (const cJSON *s = steps->child; s; s = s->next) {
                rc |= buf_str(&b, "        ");
                rc |= buf_json(&b, s);
                rc |= buf_str(&b, s->next ? ",\n" : "\n      ]");
            }
        }
        rc |= buf_str(&b, "\n    }");
    }
    if (!rc) rc = buf_str(&b, nf ? "\n  ]\n}\n" : "]\n}\n");
    if (rc) {
        free(b.p);
        return NULL;
    }
    return b.p;
}

int prog_verify(const cJSON *rt, RtProg *out, char code[8], Err *e)
{
    memset(out, 0, sizeof *out);
    code[0] = 0;
    const cJSON *schema = cJSON_IsObject(rt) ? cJSON_GetObjectItemCaseSensitive(rt, "schema") : NULL;
    if (!cJSON_IsString(schema) || !str_eq(schema->valuestring, "spm.rt/1")) {
        char *s = schema ? cJSON_PrintUnformatted(schema) : NULL;
        snprintf(code, 8, "SCHEMA");
        err_set(e, 1, "schema must be \"spm.rt/1\", not %s", s ? s : "null");
        if (s) cJSON_free(s);
        return 1;
    }
    const cJSON *flows = cJSON_GetObjectItemCaseSensitive(rt, "flows");
    const cJSON *crc = cJSON_GetObjectItemCaseSensitive(rt, "crc");
    const cJSON *tc = cJSON_GetObjectItemCaseSensitive(rt, "tags_crc");
    if (!cJSON_IsArray(flows) || !cJSON_IsString(crc) || !cJSON_IsString(tc)) {
        snprintf(code, 8, "SCHEMA");
        return err_set(e, 1, "flows, crc and tags_crc are required");
    }
    char *text = rt_format(rt, "00000000");
    if (!text) {
        snprintf(code, 8, "SCHEMA");
        return err_set(e, 1, "out of memory");
    }
    char mine[9];
    snprintf(mine, sizeof mine, "%08X", crc32_text(text, strlen(text)));
    free(text);
    if (!str_eq(mine, crc->valuestring)) {
        snprintf(code, 8, "CRC");
        return err_set(e, 1, "CRC mismatch: the file says %.16s, its flows give %s", crc->valuestring, mine);
    }
    memcpy(out->crc, mine, 9);
    snprintf(out->tags_crc, sizeof out->tags_crc, "%.8s", tc->valuestring);
    for (const cJSON *f = flows->child; f; f = f->next) {
        out->n_flows++;
        const cJSON *steps = cJSON_GetObjectItemCaseSensitive(f, "steps");
        out->n_steps += (uint32_t)cJSON_GetArraySize(steps);
    }
    return 0;
}

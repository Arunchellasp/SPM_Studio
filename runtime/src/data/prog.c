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

/* ---------------------------------------------------------------- step 37: the step table */
const char *const STEP_OP_NAMES[SO__N] = {"START", "END", "WAIT_DI", "SET_DO", "MOVE_ABS", "DELAY", "IF"};
static const char *const RPN_OPS[RK__N] = {"", "", "NOT", "NEG", "AND", "OR", "EQ", "NE", "LT", "LE", "GT", "GE", "ADD", "SUB", "MUL", "DIV"};

double tag_num(const Tag *t)
{
    switch (t->dtype) {
    case D_BOOL: return t->v.b ? 1.0 : 0.0;
    case D_REAL: return (double)t->v.f;
    default: return (double)t->v.i;
    }
}

double rpn_eval(const RpnTok *t, uint16_t n, const TagDB *db)
{
    double st[RPN_STACK];
    int sp = 0;
    for (uint16_t i = 0; i < n; i++) {
        const RpnTok *k = &t[i];
        double b;
        switch ((RpnKind)k->k) {
        case RK_TAG: st[sp++] = tag_num(&db->t[k->tag]); continue;
        case RK_K: st[sp++] = k->v; continue;
        case RK_NOT: st[sp - 1] = st[sp - 1] == 0.0 ? 1.0 : 0.0; continue;
        case RK_NEG: st[sp - 1] = -st[sp - 1]; continue;
        default: break;
        }
        b = st[--sp];
        double *a = &st[sp - 1];
        switch ((RpnKind)k->k) {
        case RK_AND: *a = (*a != 0.0 && b != 0.0) ? 1.0 : 0.0; break;
        case RK_OR: *a = (*a != 0.0 || b != 0.0) ? 1.0 : 0.0; break;
        case RK_EQ: *a = *a == b ? 1.0 : 0.0; break;
        case RK_NE: *a = *a != b ? 1.0 : 0.0; break;
        case RK_LT: *a = *a < b ? 1.0 : 0.0; break;
        case RK_LE: *a = *a <= b ? 1.0 : 0.0; break;
        case RK_GT: *a = *a > b ? 1.0 : 0.0; break;
        case RK_GE: *a = *a >= b ? 1.0 : 0.0; break;
        case RK_ADD: *a += b; break;
        case RK_SUB: *a -= b; break;
        case RK_MUL: *a *= b; break;
        case RK_DIV: *a = b == 0.0 ? 0.0 : *a / b; break; /* as the studio: no exception in the cycle */
        default: break;
        }
    }
    return sp == 1 ? st[0] : 0.0;
}

static int int_of(const cJSON *o, const char *key, long lo, long hi, long *out)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(o, key);
    if (!cJSON_IsNumber(v) || v->valuedouble != (double)(long)v->valuedouble || v->valuedouble < (double)lo || v->valuedouble > (double)hi) return 1;
    *out = (long)v->valuedouble;
    return 0;
}

int prog_build(const cJSON *rt, const TagDB *db, Prog **out, char code[8], Err *e)
{
    *out = NULL;
    snprintf(code, 8, "PROGRAM");
    const cJSON *tc = cJSON_GetObjectItemCaseSensitive(rt, "tags_crc");
    char mine[9];
    snprintf(mine, sizeof mine, "%08X", db->crc);
    if (!cJSON_IsString(tc) || !str_eq(tc->valuestring, mine)) {
        snprintf(code, 8, "TAGS");
        return err_set(e, 1, "the program was built for tags %.8s, the runtime has %s — after saving tags.json, restart spm_rt",
                       cJSON_IsString(tc) ? tc->valuestring : "?", mine);
    }
    const cJSON *flows = cJSON_GetObjectItemCaseSensitive(rt, "flows");
    int nf = cJSON_GetArraySize(flows);
    if (nf > FLOW_MAX) return err_set(e, 1, "%d flows — the runtime runs at most %d", nf, FLOW_MAX);
    /* sizes first: one block for everything */
    size_t n_steps = 0, n_tok = 0, n_text = 0;
    for (const cJSON *f = flows->child; f; f = f->next) {
        const cJSON *nm = cJSON_GetObjectItemCaseSensitive(f, "name"), *steps = cJSON_GetObjectItemCaseSensitive(f, "steps");
        n_text += (cJSON_IsString(nm) ? strlen(nm->valuestring) : 0) + 16;
        for (const cJSON *s = steps ? steps->child : NULL; s; s = s->next) {
            n_steps++;
            const cJSON *src = cJSON_GetObjectItemCaseSensitive(s, "src");
            n_text += (cJSON_IsString(src) ? strlen(src->valuestring) : 0) + 16;
            n_tok += (size_t)cJSON_GetArraySize(cJSON_GetObjectItemCaseSensitive(s, "rpn"));
        }
    }
    Arena a;
    if (arena_init(&a, sizeof(Prog) + 16 + n_steps * (sizeof(Step) + 8) + n_tok * (sizeof(RpnTok) + 8) + n_text + 64))
        return err_set(e, 1, "out of memory");
    Prog *p = (Prog *)arena_push(&a, sizeof(Prog)); /* first: p == the block */
    p->steps = (Step *)arena_push(&a, sizeof(Step) * (n_steps ? n_steps : 1));
    p->rpn = (RpnTok *)arena_push(&a, sizeof(RpnTok) * (n_tok ? n_tok : 1));
    uint32_t at = 0, tok = 0;
    int rc = 0, fi = 0;
    for (const cJSON *f = flows->child; !rc && f; f = f->next, fi++) {
        const cJSON *nm = cJSON_GetObjectItemCaseSensitive(f, "name"), *steps = cJSON_GetObjectItemCaseSensitive(f, "steps");
        long id = 0;
        FlowDef *fd = &p->flow[fi];
        fd->name = arena_strdup(&a, cJSON_IsString(nm) ? nm->valuestring : "?");
        if (int_of(f, "id", 0, FLOW_MAX - 1, &id) || id != fi) {
            rc = err_set(e, 1, "flow \"%s\": id must be %d (its place in flows)", fd->name, fi);
            break;
        }
        int ns = cJSON_GetArraySize(steps);
        if (ns < 1 || ns > 65000) {
            rc = err_set(e, 1, "flow \"%s\": %d steps (1 … 65000)", fd->name, ns);
            break;
        }
        fd->first = at;
        fd->n = (uint16_t)ns;
        int si = 0;
        for (const cJSON *s = steps->child; !rc && s; s = s->next, si++) {
            Step *st = &p->steps[at + (uint32_t)si];
            const cJSON *op = cJSON_GetObjectItemCaseSensitive(s, "op"), *src = cJSON_GetObjectItemCaseSensitive(s, "src");
            st->src = arena_strdup(&a, cJSON_IsString(src) ? src->valuestring : "?");
            st->alarm = st->tag = st->axis = st->point = (uint16_t)NO_TAG;
            int k = -1;
            for (int q = 0; cJSON_IsString(op) && q < SO__N; q++)
                if (str_eq(op->valuestring, STEP_OP_NAMES[q])) k = q;
            long v = 0, i = 0;
#define BAD(...) (rc = err_set(e, 1, __VA_ARGS__))
            const char *where = fd->name;
            if (int_of(s, "i", 0, 65000, &i) || i != si) {
                BAD("flow \"%s\" step %d: \"i\" must be %d", where, si, si);
                break;
            }
            if (k < 0) {
                BAD("flow \"%s\" step %d (%s): unknown op", where, si, st->src);
                break;
            }
            st->op = (uint8_t)k;
            if (k != SO_END && k != SO_IF && int_of(s, "next", 0, ns - 1, &v)) {
                BAD("flow \"%s\" step %d (%s): \"next\" must be a step of this flow (0 … %d)", where, si, st->src, ns - 1);
                break;
            }
            st->next = k != SO_END && k != SO_IF ? (uint16_t)v : 0;
            const Tag *t;
            switch ((StepOp)k) {
            case SO_START:
            case SO_END: break;
            case SO_WAIT_DI:
            case SO_SET_DO: {
                long val = 0, tg = 0;
                if (int_of(s, "tag", 0, db->n - 1, &tg)) {
                    BAD("flow \"%s\" step %d (%s): \"tag\" is not a tag id (0 … %d)", where, si, st->src, db->n - 1);
                    break;
                }
                t = &db->t[tg];
                int ok = k == SO_SET_DO ? t->kind == K_DO : (t->kind == K_DI || (t->kind == K_REG && t->dtype == D_BOOL));
                if (!ok) {
                    BAD("flow \"%s\" step %d (%s): %s is a %s — %s needs %s", where, si, st->src, t->name, kind_name(t->kind), STEP_OP_NAMES[k],
                        k == SO_SET_DO ? "a DO" : "a DI or a BOOL register");
                    break;
                }
                if (int_of(s, "val", 0, 1, &val)) {
                    BAD("flow \"%s\" step %d (%s): \"val\" must be 0 or 1", where, si, st->src);
                    break;
                }
                st->tag = (uint16_t)tg;
                st->val = (uint8_t)val;
                if (k == SO_WAIT_DI) {
                    long tmo = 0, al = 0;
                    if (int_of(s, "tmo", 0, 86400000, &tmo)) {
                        BAD("flow \"%s\" step %d (%s): \"tmo\" must be 0 … 86400000 ms", where, si, st->src);
                        break;
                    }
                    st->tmo = (uint32_t)tmo;
                    if (cJSON_GetObjectItemCaseSensitive(s, "alarm")) {
                        if (int_of(s, "alarm", 0, db->n - 1, &al) || db->t[al].kind != K_ALARM) {
                            BAD("flow \"%s\" step %d (%s): \"alarm\" must be an ALARM tag", where, si, st->src);
                            break;
                        }
                        st->alarm = (uint16_t)al;
                    }
                }
                break;
            }
            case SO_MOVE_ABS: {
                long ax = 0, pt = 0, spd = 0;
                if (int_of(s, "axis", 0, db->n - 1, &ax) || db->t[ax].kind != K_AXIS || db->t[ax].io < 0) {
                    BAD("flow \"%s\" step %d (%s): \"axis\" must be an AXIS on the card", where, si, st->src);
                    break;
                }
                if (int_of(s, "point", 0, db->n - 1, &pt) || db->t[pt].kind != K_POINT) {
                    BAD("flow \"%s\" step %d (%s): \"point\" must be a POINT", where, si, st->src);
                    break;
                }
                if (int_of(s, "spd", 1, 100, &spd)) {
                    BAD("flow \"%s\" step %d (%s): \"spd\" must be 1 … 100 %%", where, si, st->src);
                    break;
                }
                const PointDef *pd = db->t[pt].point;
                int q = 0;
                while (q < pd->n && pd->axis[q] != (uint16_t)ax) q++;
                if (q == pd->n) {
                    BAD("flow \"%s\" step %d (%s): point %s has no value for axis %s", where, si, st->src, db->t[pt].name, db->t[ax].name);
                    break;
                }
                const AxisDef *ad = db->t[ax].axis;
                if (ad->soft_min < ad->soft_max && (pd->val[q] < ad->soft_min || pd->val[q] > ad->soft_max)) {
                    BAD("flow \"%s\" step %d (%s): %s = %g is outside the soft limits of %s (%g … %g)", where, si, st->src, db->t[pt].name,
                        (double)pd->val[q], db->t[ax].name, (double)ad->soft_min, (double)ad->soft_max);
                    break;
                }
                st->axis = (uint16_t)ax;
                st->point = (uint16_t)pt;
                st->spd = (uint8_t)spd;
                st->target = pd->val[q];
                break;
            }
            case SO_DELAY: {
                long ms = 0;
                if (int_of(s, "ms", 0, 86400000, &ms)) {
                    BAD("flow \"%s\" step %d (%s): \"ms\" must be 0 … 86400000", where, si, st->src);
                    break;
                }
                st->ms = (uint32_t)ms;
                break;
            }
            case SO_IF: {
                long yes = 0, no = 0;
                if (int_of(s, "yes", 0, ns - 1, &yes) || int_of(s, "no", 0, ns - 1, &no)) {
                    BAD("flow \"%s\" step %d (%s): \"yes\" and \"no\" must be steps of this flow", where, si, st->src);
                    break;
                }
                st->yes = (uint16_t)yes;
                st->no = (uint16_t)no;
                st->rpn_at = tok;
                int depth = 0;
                const cJSON *r = cJSON_GetObjectItemCaseSensitive(s, "rpn");
                for (const cJSON *x = cJSON_IsArray(r) ? r->child : NULL; !rc && x; x = x->next) {
                    RpnTok *tk = &p->rpn[tok++];
                    const char *w = cJSON_IsString(x) ? x->valuestring : "";
                    if (w[0] == 'T' && w[1] == ':') {
                        char *end;
                        long tid = strtol(w + 2, &end, 10);
                        if (*end || tid < 0 || tid >= db->n) BAD("flow \"%s\" step %d (%s): RPN \"%s\" is not a tag id", where, si, st->src, w);
                        tk->k = RK_TAG;
                        tk->tag = (uint16_t)tid;
                        depth++;
                    } else if (w[0] == 'K' && w[1] == ':') {
                        char *end;
                        tk->v = strtod(w + 2, &end);
                        if (*end || !w[2]) BAD("flow \"%s\" step %d (%s): RPN \"%s\" is not a number", where, si, st->src, w);
                        tk->k = RK_K;
                        depth++;
                    } else {
                        int q = RK_NOT;
                        while (q < RK__N && !str_eq(w, RPN_OPS[q])) q++;
                        if (q == RK__N) {
                            BAD("flow \"%s\" step %d (%s): RPN \"%s\" is unknown", where, si, st->src, w);
                            break;
                        }
                        tk->k = (uint8_t)q;
                        int need = q == RK_NOT || q == RK_NEG ? 1 : 2;
                        if (depth < need) BAD("flow \"%s\" step %d (%s): RPN takes from an empty stack at \"%s\"", where, si, st->src, w);
                        depth -= need - 1;
                    }
                    if (depth > RPN_STACK) BAD("flow \"%s\" step %d (%s): RPN deeper than %d", where, si, st->src, RPN_STACK);
                }
                if (!rc && depth != 1) BAD("flow \"%s\" step %d (%s): RPN leaves %d values (must be 1)", where, si, st->src, depth);
                st->rpn_n = (uint16_t)(tok - st->rpn_at);
                break;
            }
            default: break;
            }
#undef BAD
        }
        at += (uint32_t)ns;
    }
    if (rc) {
        free(p);
        return rc;
    }
    p->n_flows = (uint16_t)nf;
    *out = p;
    return 0;
}

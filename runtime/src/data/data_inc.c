#ifdef _WIN32
#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#endif
#include <stdio.h>
#include <string.h>
#include "../../third_party/cjson/cJSON.h"
#include "../os/os_inc.h"
#include "data_inc.h"

/* ---------------------------------------------------------------- config.json */
static int num_in(const cJSON *o, const char *key, double lo, double hi, double *out, const char *file, Err *e)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(o, key);
    if (!v) return 0; /* keep the default */
    if (!cJSON_IsNumber(v) || v->valuedouble != (double)(long long)v->valuedouble)
        return err_set(e, 1, "%s: \"%s\" must be a whole number", file, key);
    if (v->valuedouble < lo || v->valuedouble > hi) return err_set(e, 1, "%s: \"%s\" must be %.0f … %.0f (is %.0f)", file, key, lo, hi, v->valuedouble);
    *out = v->valuedouble;
    return 0;
}
static int str_in(const cJSON *o, const char *key, char *out, size_t cap, const char *file, Err *e)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(o, key);
    if (!v) return 0;
    if (!cJSON_IsString(v) || !v->valuestring[0]) return err_set(e, 1, "%s: \"%s\" must be a text", file, key);
    snprintf(out, cap, "%s", v->valuestring);
    return 0;
}

static const char *CFG_KEYS[] = {"schema", "card", "cycle_us", "spin_us", "cpu", "tags", "program", "log", "ws_port", "stats_s", "sim", NULL};

int cfg_load(const char *path, RtConfig *cfg, Err *e)
{
    memset(cfg, 0, sizeof *cfg);
    os_dir_of(path, cfg->dir, sizeof cfg->dir);
    snprintf(cfg->card, sizeof cfg->card, "sim");
    cfg->cycle_us = 1000;
    cfg->spin_us = 200;
    cfg->cpu = -1;
    cfg->ws_port = 7600;
    cfg->stats_s = 10;
    cfg->sim_cyl_ms = 200;
    char tags[SPM_PATH_MAX] = "tags.json", prog[SPM_PATH_MAX] = "program.rt.json", log[SPM_PATH_MAX] = "logs/spm_rt.log";

    Arena a;
    if (arena_init(&a, 1u << 20)) return err_set(e, 1, "out of memory");
    char *text = NULL;
    int rc = os_read_file(path, &a, &text, NULL, e);
    cJSON *root = rc ? NULL : cJSON_Parse(text);
    if (!rc && !root) rc = err_set(e, 1, "%s is not valid JSON (near: %.30s)", path, cJSON_GetErrorPtr() ? cJSON_GetErrorPtr() : "?");
    if (!rc && !cJSON_IsObject(root)) rc = err_set(e, 1, "%s: must be a JSON object", path);
    if (!rc) {
        const cJSON *s = cJSON_GetObjectItemCaseSensitive(root, "schema");
        if (!cJSON_IsString(s) || !str_eq(s->valuestring, "spm.config/1"))
            rc = err_set(e, 1, "%s: \"schema\" must be \"spm.config/1\"", path);
    }
    for (const cJSON *it = root ? root->child : NULL; !rc && it; it = it->next) { /* a typo must not be ignored */
        int known = 0;
        for (int i = 0; CFG_KEYS[i]; i++) known |= str_eq(it->string, CFG_KEYS[i]);
        if (!known) rc = err_set(e, 1, "%s: unknown setting \"%s\"", path, it->string);
    }
    double d;
    d = cfg->cycle_us;
    if (!rc) rc = num_in(root, "cycle_us", 250, 10000, &d, path, e);
    if (!rc) cfg->cycle_us = (uint32_t)d; /* d is the default when the key is missing */
    d = cfg->spin_us;
    if (!rc) rc = num_in(root, "spin_us", 0, 5000, &d, path, e);
    if (!rc) cfg->spin_us = (uint32_t)d; /* d is the default when the key is missing */
    d = cfg->cpu;
    if (!rc) rc = num_in(root, "cpu", -1, 255, &d, path, e);
    if (!rc) cfg->cpu = (int)d; /* d is the default when the key is missing */
    d = cfg->ws_port;
    if (!rc) rc = num_in(root, "ws_port", 1, 65535, &d, path, e);
    if (!rc) cfg->ws_port = (uint16_t)d; /* d is the default when the key is missing */
    d = cfg->stats_s;
    if (!rc) rc = num_in(root, "stats_s", 1, 3600, &d, path, e);
    if (!rc) cfg->stats_s = (uint32_t)d; /* d is the default when the key is missing */
    if (!rc) rc = str_in(root, "card", cfg->card, sizeof cfg->card, path, e);
    if (!rc) rc = str_in(root, "tags", tags, sizeof tags, path, e);
    if (!rc) rc = str_in(root, "program", prog, sizeof prog, path, e);
    if (!rc) rc = str_in(root, "log", log, sizeof log, path, e);
    if (!rc) {
        const cJSON *sim = cJSON_GetObjectItemCaseSensitive(root, "sim");
        if (sim && !cJSON_IsObject(sim)) rc = err_set(e, 1, "%s: \"sim\" must be an object", path);
        d = cfg->sim_cyl_ms;
        if (!rc && sim) rc = num_in(sim, "cylinder_ms", 0, 60000, &d, path, e);
        if (!rc) cfg->sim_cyl_ms = (uint32_t)d; /* d is the default when the key is missing */
        for (const cJSON *it = sim ? sim->child : NULL; !rc && it; it = it->next)
            if (!str_eq(it->string, "cylinder_ms") && !str_eq(it->string, "demo_alarms"))
                rc = err_set(e, 1, "%s: unknown setting \"sim.%s\"", path, it->string);
        const cJSON *demo = sim ? cJSON_GetObjectItemCaseSensitive(sim, "demo_alarms") : NULL;
        if (!rc && demo && !cJSON_IsBool(demo)) rc = err_set(e, 1, "%s: \"sim.demo_alarms\" must be true or false", path);
        if (!rc) cfg->sim_demo_alarms = (uint8_t)cJSON_IsTrue(demo);
    }
    if (!rc && cfg->spin_us >= cfg->cycle_us) rc = err_set(e, 1, "%s: \"spin_us\" (%u) must be less than \"cycle_us\" (%u)", path, cfg->spin_us, cfg->cycle_us);
    if (!rc && !str_eq(cfg->card, "sim"))
        rc = err_set(e, 1, "%s: card \"%s\" is not in this runtime yet (only \"sim\")", path, cfg->card);
    if (!rc) {
        os_join(cfg->dir, tags, cfg->tags_path, sizeof cfg->tags_path);
        os_join(cfg->dir, prog, cfg->program_path, sizeof cfg->program_path);
        os_join(cfg->dir, log, cfg->log_path, sizeof cfg->log_path);
    }
    cJSON_Delete(root);
    arena_free(&a);
    return rc;
}

/* ---------------------------------------------------------------- tags.json */
static const char *KIND_NAMES[K__N] = {"DI", "DO", "AI", "AO", "AXIS", "POINT", "REG", "TIMER", "COUNTER", "ALARM", "RECIPE", "UDT"};
static const char *DTYPE_NAMES[D__N] = {"BOOL", "INT", "DINT", "REAL", "STRING", "STRUCT"};
const char *kind_name(TagKind k)
{
    return k < K__N ? KIND_NAMES[k] : "?";
}

static uint32_t name_hash(const char *s)
{
    uint32_t h = 2166136261u; /* FNV-1a */
    while (*s) h = (h ^ (uint8_t)*s++) * 16777619u;
    return h;
}

int tagdb_find(const TagDB *db, const char *name)
{
    if (!db->hcap) return -1;
    for (uint32_t i = name_hash(name) & (db->hcap - 1);; i = (i + 1) & (db->hcap - 1)) {
        uint32_t slot = db->hash[i];
        if (!slot) return -1;
        if (str_eq(db->t[slot - 1].name, name)) return (int)(slot - 1);
    }
}

static int pick(const char *s, const char *const *names, int n)
{
    for (int i = 0; i < n; i++)
        if (str_eq(s, names[i])) return i;
    return -1;
}

/* pass 1 of one tag; a UDT's field targets are kept as names in targets[] (resolved in pass 2) */
#define MAX_UDT_REFS 4096
static int load_tag(const cJSON *j, Tag *t, uint16_t id, Arena *a, const char *file, Err *e, const char **targets, int *n_targets)
{
    const cJSON *name = cJSON_GetObjectItemCaseSensitive(j, "name");
    const cJSON *kind = cJSON_GetObjectItemCaseSensitive(j, "kind");
    const cJSON *dtype = cJSON_GetObjectItemCaseSensitive(j, "dtype");
    if (!cJSON_IsString(name) || !name->valuestring[0]) return err_set(e, 2, "%s: tag %u has no name", file, id);
    const char *nm = name->valuestring;
    int k = cJSON_IsString(kind) ? pick(kind->valuestring, KIND_NAMES, K__N) : -1;
    if (k < 0) return err_set(e, 2, "%s: tag %u \"%s\": unknown kind \"%s\"", file, id, nm, cJSON_IsString(kind) ? kind->valuestring : "?");
    int d = cJSON_IsString(dtype) ? pick(dtype->valuestring, DTYPE_NAMES, D__N) : -1;
    if (d < 0) return err_set(e, 2, "%s: tag %u \"%s\": unknown dtype \"%s\"", file, id, nm, cJSON_IsString(dtype) ? dtype->valuestring : "?");
    t->id = id;
    t->kind = (TagKind)k;
    t->dtype = (DType)d;
    t->name = arena_strdup(a, nm);
    t->k = 1.0f;
    t->o = 0.0f;
    t->io = -1;
    t->addr.ch = -1;
    if (cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(j, "retain"))) t->flags |= F_RETAIN;
    if (cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(j, "invert"))) t->flags |= F_INVERT;
    const cJSON *lg = cJSON_GetObjectItemCaseSensitive(j, "log");
    if (cJSON_IsString(lg) && str_eq(lg->valuestring, "change")) t->flags |= F_LOG_CHANGE;

    const cJSON *addr = cJSON_GetObjectItemCaseSensitive(j, "addr");
    int io = k == K_DI || k == K_DO || k == K_AI || k == K_AO;
    if ((io || k == K_AXIS) && !cJSON_IsObject(addr)) return err_set(e, 2, "%s: %s \"%s\" has no address", file, KIND_NAMES[k], nm);
    if (cJSON_IsObject(addr)) {
        const cJSON *bus = cJSON_GetObjectItemCaseSensitive(addr, "bus");
        const cJSON *slave = cJSON_GetObjectItemCaseSensitive(addr, "slave");
        const cJSON *ch = cJSON_GetObjectItemCaseSensitive(addr, "ch");
        t->addr.bus = cJSON_IsString(bus) && str_eq(bus->valuestring, "sim") ? BUS_SIM : BUS_ECAT;
        if (!cJSON_IsNumber(slave) || slave->valueint < 0 || slave->valueint > 4095) return err_set(e, 2, "%s: \"%s\": address slave must be 0 … 4095", file, nm);
        t->addr.slave = (uint16_t)slave->valueint;
        if (io && (!cJSON_IsNumber(ch) || ch->valueint < 0 || ch->valueint > 255)) return err_set(e, 2, "%s: \"%s\": address ch must be 0 … 255", file, nm);
        if (cJSON_IsNumber(ch)) t->addr.ch = (int16_t)ch->valueint;
    }
    const cJSON *sc = cJSON_GetObjectItemCaseSensitive(j, "scale");
    if (cJSON_IsObject(sc)) { /* eng = raw * k + o, from the two points raw[0..1] → eng[0..1] */
        const cJSON *raw = cJSON_GetObjectItemCaseSensitive(sc, "raw"), *eng = cJSON_GetObjectItemCaseSensitive(sc, "eng");
        if (cJSON_GetArraySize(raw) != 2 || cJSON_GetArraySize(eng) != 2) return err_set(e, 2, "%s: \"%s\": scale needs raw [a, b] and eng [c, d]", file, nm);
        double r0 = cJSON_GetArrayItem(raw, 0)->valuedouble, r1 = cJSON_GetArrayItem(raw, 1)->valuedouble;
        double e0 = cJSON_GetArrayItem(eng, 0)->valuedouble, e1 = cJSON_GetArrayItem(eng, 1)->valuedouble;
        if (r1 == r0) return err_set(e, 2, "%s: \"%s\": scale raw range is empty", file, nm);
        t->k = (float)((e1 - e0) / (r1 - r0));
        t->o = (float)(e0 - r0 * (e1 - e0) / (r1 - r0));
    }
    if (k == K_AXIS) { /* step 37: speed and soft limits for MOVE_ABS */
        if (!(t->axis = (AxisDef *)arena_push(a, sizeof(AxisDef)))) return err_set(e, 2, "load arena full");
        const cJSON *vm = cJSON_GetObjectItemCaseSensitive(j, "vmax"), *ac = cJSON_GetObjectItemCaseSensitive(j, "acc");
        const cJSON *lo = cJSON_GetObjectItemCaseSensitive(j, "soft_min"), *hi = cJSON_GetObjectItemCaseSensitive(j, "soft_max");
        if (!cJSON_IsNumber(vm) || vm->valuedouble <= 0) return err_set(e, 2, "%s: axis \"%s\" needs vmax > 0", file, nm);
        t->axis->vmax = (float)vm->valuedouble;
        t->axis->acc = cJSON_IsNumber(ac) ? (float)ac->valuedouble : 0.0f;
        t->axis->soft_min = cJSON_IsNumber(lo) ? (float)lo->valuedouble : 0.0f;
        t->axis->soft_max = cJSON_IsNumber(hi) ? (float)hi->valuedouble : 0.0f;
        if (t->axis->soft_min > t->axis->soft_max) return err_set(e, 2, "%s: axis \"%s\": soft_min > soft_max", file, nm);
    }
    if (k == K_POINT) { /* step 37: the position of each axis; the axis names are resolved in pass 2 */
        const cJSON *ax = cJSON_GetObjectItemCaseSensitive(j, "axes"), *vals = cJSON_GetObjectItemCaseSensitive(j, "values");
        int n = cJSON_GetArraySize(ax);
        if (!cJSON_IsArray(ax) || !cJSON_IsArray(vals) || n != cJSON_GetArraySize(vals) || n < 1 || n > POINT_AXES)
            return err_set(e, 2, "%s: point \"%s\" needs \"axes\" and \"values\" of the same length (1 … %d)", file, nm, POINT_AXES);
        if (!(t->point = (PointDef *)arena_push(a, sizeof(PointDef)))) return err_set(e, 2, "load arena full");
        for (int q = 0; q < n; q++) {
            const cJSON *an = cJSON_GetArrayItem(ax, q), *v = cJSON_GetArrayItem(vals, q);
            if (!cJSON_IsString(an) || !cJSON_IsNumber(v)) return err_set(e, 2, "%s: point \"%s\": axes are names, values numbers", file, nm);
            t->point->axis_name[q] = arena_strdup(a, an->valuestring);
            t->point->val[q] = (float)v->valuedouble;
        }
        t->point->n = (uint8_t)n;
    }
    if (k == K_ALARM) { /* step 37: raised by a WAIT_DI timeout */
        if (!(t->alarm = (AlarmTagDef *)arena_push(a, sizeof(AlarmTagDef)))) return err_set(e, 2, "load arena full");
        const cJSON *code = cJSON_GetObjectItemCaseSensitive(j, "code"), *tx = cJSON_GetObjectItemCaseSensitive(j, "text");
        const cJSON *sev = cJSON_GetObjectItemCaseSensitive(j, "severity"), *re = cJSON_GetObjectItemCaseSensitive(j, "reaction");
        if (cJSON_IsNumber(code))
            snprintf(t->alarm->code, sizeof t->alarm->code, "A%d", code->valueint);
        else
            snprintf(t->alarm->code, sizeof t->alarm->code, "%.15s", nm);
        t->alarm->text = arena_strdup(a, cJSON_IsString(tx) ? tx->valuestring : nm);
        t->alarm->priority = (uint8_t)(cJSON_IsNumber(sev) && sev->valueint >= 1 && sev->valueint <= 3 ? sev->valueint : 2);
        const char *r = cJSON_IsString(re) ? re->valuestring : "";
        t->alarm->reaction = (uint8_t)(str_eq(r, "pause") ? AR_PAUSE : str_eq(r, "stop") ? AR_STOP : str_eq(r, "abort") ? AR_ABORT : AR_NONE);
    }
    if (k == K_UDT) {
        const cJSON *ty = cJSON_GetObjectItemCaseSensitive(j, "type"), *fs = cJSON_GetObjectItemCaseSensitive(j, "fields");
        t->udt_type = cJSON_IsString(ty) ? arena_strdup(a, ty->valuestring) : "";
        int n = cJSON_IsObject(fs) ? cJSON_GetArraySize(fs) : 0;
        if (n > 32) return err_set(e, 2, "%s: UDT \"%s\" has more than 32 fields", file, nm);
        t->fields = (UdtField *)arena_push(a, sizeof(UdtField) * (size_t)(n ? n : 1));
        if (!t->fields) return err_set(e, 2, "load arena full");
        for (const cJSON *f = fs ? fs->child : NULL; f; f = f->next) {
            if (!cJSON_IsString(f)) return err_set(e, 2, "%s: UDT \"%s\": field \"%s\" must name a tag", file, nm, f->string);
            if (*n_targets >= MAX_UDT_REFS) return err_set(e, 2, "%s: more than %d UDT fields", file, MAX_UDT_REFS);
            UdtField *u = &t->fields[t->n_fields++];
            u->name = arena_strdup(a, f->string);
            u->tag = 0xFFFF;
            targets[(*n_targets)++] = arena_strdup(a, f->valuestring);
        }
    }
    return 0;
}

int tagdb_load(const char *path, Arena *a, TagDB *db, Err *e)
{
    memset(db, 0, sizeof *db);
    char *text = NULL;
    size_t len = 0;
    if (os_read_file(path, a, &text, &len, e)) return 2;
    db->crc = crc32_lf(text, len);
    cJSON *root = cJSON_Parse(text);
    int rc = 0;
    if (!root) rc = err_set(e, 2, "%s is not valid JSON (near: %.30s)", path, cJSON_GetErrorPtr() ? cJSON_GetErrorPtr() : "?");
    const cJSON *s = root ? cJSON_GetObjectItemCaseSensitive(root, "schema") : NULL;
    if (!rc && (!cJSON_IsString(s) || !str_eq(s->valuestring, "spm.tags/1"))) rc = err_set(e, 2, "%s: \"schema\" must be \"spm.tags/1\"", path);
    const cJSON *arr = root ? cJSON_GetObjectItemCaseSensitive(root, "tags") : NULL;
    if (!rc && !cJSON_IsArray(arr)) rc = err_set(e, 2, "%s: \"tags\" must be a list", path);
    int n = rc ? 0 : cJSON_GetArraySize(arr);
    if (!rc && n > 65000) rc = err_set(e, 2, "%s: %d tags — the runtime takes at most 65000", path, n);
    if (!rc) {
        db->t = (Tag *)arena_push(a, sizeof(Tag) * (size_t)(n ? n : 1));
        db->hcap = 16;
        while (db->hcap < (uint32_t)n * 2u) db->hcap <<= 1;
        db->hash = (uint32_t *)arena_push(a, sizeof(uint32_t) * db->hcap);
        if (!db->t || !db->hash) rc = err_set(e, 2, "%s: load arena full", path);
    }
    /* pass 1: every tag; the UDT field targets are kept as names for pass 2 */
    const char **targets = NULL;
    int n_targets = 0;
    if (!rc) targets = (const char **)arena_push(a, sizeof(char *) * MAX_UDT_REFS);
    int i = 0;
    for (const cJSON *j = arr ? arr->child : NULL; !rc && j; j = j->next, i++) {
        Tag *t = &db->t[i];
        const cJSON *nm = cJSON_GetObjectItemCaseSensitive(j, "name");
        if (cJSON_IsString(nm) && tagdb_find(db, nm->valuestring) >= 0) {
            rc = err_set(e, 2, "%s: tag %d \"%s\": the name is used twice", path, i, nm->valuestring);
            break;
        }
        rc = load_tag(j, t, (uint16_t)i, a, path, e, targets, &n_targets);
        if (rc) break;
        db->n = (uint16_t)(i + 1);
        uint32_t h = name_hash(t->name) & (db->hcap - 1);
        while (db->hash[h]) h = (h + 1) & (db->hcap - 1);
        db->hash[h] = (uint32_t)i + 1u;
    }
    /* pass 2: UDT fields → tag ids */
    int ti = 0;
    for (uint16_t k = 0; !rc && k < db->n; k++) {
        Tag *t = &db->t[k];
        for (uint8_t f = 0; !rc && f < t->n_fields; f++) {
            const char *target = targets[ti++];
            int id = tagdb_find(db, target);
            if (id < 0) rc = err_set(e, 2, "%s: UDT \"%s\": field \"%s\" names \"%s\", which is not a tag", path, t->name, t->fields[f].name, target);
            else t->fields[f].tag = (uint16_t)id;
        }
        for (uint8_t q = 0; !rc && t->point && q < t->point->n; q++) { /* step 37: point axes → tag ids */
            int id = tagdb_find(db, t->point->axis_name[q]);
            if (id < 0 || db->t[id].kind != K_AXIS)
                rc = err_set(e, 2, "%s: point \"%s\": \"%s\" is not an axis", path, t->name, t->point->axis_name[q]);
            else
                t->point->axis[q] = (uint16_t)id;
        }
    }
    cJSON_Delete(root);
    return rc;
}

/*
 * Unity tests of step 36 (included by test_runtime.c): the studio link.
 *   U-36.1 decode · U-36.2 encode (the mock's JSON) · U-36.3 PackML table · U-36.4 alarm list rule
 *   U-36.5 the machine (commands, acting states, alarm demo, download, ack) · U-36.6 program check (CRC)
 *   U-36.7 queue, ring, value triple buffer · U-36.8 a real WebSocket round trip (civetweb client)
 */

static const char *data_file(const char *name)
{
    static char p[700];
    snprintf(p, sizeof p, "%s/../runtime/tests/data/%s", g_demo, name);
    return p;
}
static char *slurp(const char *path)
{
    FILE *f = fopen(path, "rb");
    TEST_ASSERT_NOT_NULL_MESSAGE(f, path);
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *s = (char *)malloc((size_t)n + 1);
    TEST_ASSERT_EQUAL_size_t((size_t)n, fread(s, 1, (size_t)n, f));
    s[n] = 0;
    fclose(f);
    return s;
}
#define ASSERT_JSON(expected, got)            \
    do {                                      \
        char *g_ = (got);                     \
        TEST_ASSERT_EQUAL_STRING(expected, g_); \
        free(g_);                             \
    } while (0)

/* ---------------------------------------------------------------- U-36.1 decode */
static void test_U36_1_decode_ping_commands_and_mistakes(void)
{
    Msg m;
    TEST_ASSERT_EQUAL_INT(MSG_PING, msg_decode("{\"t\":\"ping\"}", 12, &m));
    TEST_ASSERT_EQUAL_INT(MSG_IGNORE, msg_decode("not json", 8, &m));
    TEST_ASSERT_EQUAL_INT(MSG_IGNORE, msg_decode("{\"t\":\"state\"}", 13, &m));
    const char *s = "{\"t\":\"cmd\",\"id\":7,\"op\":\"reset\"}";
    TEST_ASSERT_EQUAL_INT(MSG_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_EQUAL_INT(7, m.cmd.id);
    TEST_ASSERT_EQUAL_INT(OP_RESET, m.cmd.op);
    s = "{\"t\":\"cmd\",\"id\":8,\"op\":\"mode\",\"mode\":\"Maintenance\"}";
    TEST_ASSERT_EQUAL_INT(MSG_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_EQUAL_INT(PM_MAINTENANCE, m.cmd.mode);
    s = "{\"t\":\"cmd\",\"id\":9,\"op\":\"mode\",\"mode\":\"Turbo\"}";
    TEST_ASSERT_EQUAL_INT(MSG_BAD_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_EQUAL_STRING("MODE", m.err);
    TEST_ASSERT_EQUAL_STRING("unknown mode 'Turbo'", m.why);
    s = "{\"t\":\"cmd\",\"id\":10,\"op\":\"ack\",\"code\":\"W0310\",\"user\":\"A. Engineer\"}";
    TEST_ASSERT_EQUAL_INT(MSG_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_EQUAL_STRING("W0310", m.cmd.code);
    TEST_ASSERT_EQUAL_STRING("A. Engineer", m.cmd.user);
    s = "{\"t\":\"cmd\",\"id\":11,\"op\":\"fly\"}";
    TEST_ASSERT_EQUAL_INT(MSG_BAD_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_EQUAL_STRING("UNKNOWN_OP", m.err);
    TEST_ASSERT_EQUAL_STRING("op 'fly' not supported", m.why);
    s = "{\"t\":\"cmd\",\"id\":12,\"op\":\"write\",\"tag\":9,\"value\":true}";
    TEST_ASSERT_EQUAL_INT(MSG_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_EQUAL_INT(9, m.cmd.tag);
    TEST_ASSERT_TRUE(m.cmd.is_bool);
    TEST_ASSERT_EQUAL_DOUBLE(1.0, m.cmd.value);
    s = "{\"t\":\"cmd\",\"id\":13,\"op\":\"write\",\"tag\":\"x\",\"value\":1}";
    TEST_ASSERT_EQUAL_INT(MSG_BAD_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_EQUAL_STRING("UNKNOWN_TAG", m.err);
    s = "{\"t\":\"cmd\",\"id\":14,\"op\":\"download\",\"rt\":{\"schema\":\"spm.rt/1\"}}";
    TEST_ASSERT_EQUAL_INT(MSG_CMD, msg_decode(s, strlen(s), &m));
    TEST_ASSERT_TRUE(cJSON_IsObject(m.rt)); /* the program stays with the message, for the CRC check */
    msg_free(&m);
    TEST_ASSERT_NULL(m.rt);
}

/* ---------------------------------------------------------------- U-36.2 encode */
static void test_U36_2_encode_the_same_json_as_the_mock_runtime(void)
{
    ASSERT_JSON("{\"t\":\"pong\",\"version\":\"0.3.0\",\"cycle_us\":1000,\"cycle_max_us\":1042}", msg_pong("0.3.0", 1000, 1042));
    ASSERT_JSON("{\"t\":\"evt\",\"ev\":\"machine\",\"ts\":1700000000000,\"state\":\"EXECUTE\",\"mode\":\"Auto\",\"prog\":null}",
                msg_machine(1700000000000ull, PS_EXECUTE, PM_AUTO, ""));
    ASSERT_JSON("{\"t\":\"evt\",\"ev\":\"machine\",\"ts\":5,\"state\":\"STOPPED\",\"mode\":\"Maintenance\",\"prog\":\"8FF94EA7\"}",
                msg_machine(5, PS_STOPPED, PM_MAINTENANCE, "8FF94EA7"));
    Ev e;
    memset(&e, 0, sizeof e);
    e.id = 3;
    e.ok = 1;
    ASSERT_JSON("{\"t\":\"res\",\"id\":3,\"ok\":true}", msg_res(&e));
    snprintf(e.crc, sizeof e.crc, "8FF94EA7");
    ASSERT_JSON("{\"t\":\"res\",\"id\":3,\"ok\":true,\"crc\":\"8FF94EA7\"}", msg_res(&e));
    e.ok = 0;
    snprintf(e.err, sizeof e.err, "STATE");
    snprintf(e.msg, sizeof e.msg, "say \"no\"");
    ASSERT_JSON("{\"t\":\"res\",\"id\":3,\"ok\":false,\"err\":\"STATE\",\"msg\":\"say \\\"no\\\"\"}", msg_res(&e));
    memset(&e, 0, sizeof e);
    e.act = AL_RAISE;
    snprintf(e.code, sizeof e.code, "W0310");
    e.text = "Glue level below 20 % (station 3)";
    e.priority = 3;
    ASSERT_JSON("{\"t\":\"evt\",\"ts\":9,\"ev\":\"alarm\",\"act\":\"raise\",\"code\":\"W0310\",\"text\":\"Glue level below 20 % (station 3)\","
                "\"priority\":3,\"time\":\"12:30:00\"}",
                msg_alarm(9, &e, "12:30:00"));
    e.act = AL_ACK;
    snprintf(e.by, sizeof e.by, "A. Engineer");
    ASSERT_JSON("{\"t\":\"evt\",\"ts\":9,\"ev\":\"alarm\",\"act\":\"ack\",\"code\":\"W0310\",\"time\":\"12:30:05\",\"by\":\"A. Engineer\"}",
                msg_alarm(9, &e, "12:30:05"));
    e.act = AL_CLEAR;
    ASSERT_JSON("{\"t\":\"evt\",\"ts\":9,\"ev\":\"alarm\",\"act\":\"clear\",\"code\":\"W0310\",\"time\":\"12:30:09\"}", msg_alarm(9, &e, "12:30:09"));
    AlarmList l;
    memset(&l, 0, sizeof l);
    ASSERT_JSON("{\"t\":\"evt\",\"ts\":1,\"ev\":\"alarms\",\"list\":[]}", msg_alarms(1, &l));
    alarm_apply(&l, AL_RAISE, "E1202", "Plasma", 1, "08:00:00");
    ASSERT_JSON("{\"t\":\"evt\",\"ts\":1,\"ev\":\"alarms\",\"list\":[{\"code\":\"E1202\",\"text\":\"Plasma\",\"priority\":1,\"time\":\"08:00:00\","
                "\"acked\":false,\"active\":true}]}",
                msg_alarms(1, &l));
    /* state: every value, then only the changed ones; BOOL as true / false, REAL as a number */
    TagDB db;
    Err er = {""};
    TEST_ASSERT_EQUAL_INT(0, tagdb_load(demo("tags.json"), &A, &db, &er));
    Value *v = (Value *)calloc(db.n, sizeof *v), *prev = (Value *)calloc(db.n, sizeof *v);
    char *full = msg_state(1, &db, v, NULL);
    TEST_ASSERT_NOT_NULL(strstr(full, "\"9\":false"));
    TEST_ASSERT_NOT_NULL(strstr(full, "\"0\":0"));
    free(full);
    v[9].b = 1;
    v[0].f = 21.5f;
    ASSERT_JSON("{\"t\":\"state\",\"seq\":2,\"v\":{\"0\":21.5,\"9\":true},\"pc\":{}}", msg_state(2, &db, v, prev));
    free(v);
    free(prev);
}

/* ---------------------------------------------------------------- U-36.3 PackML */
static void test_U36_3_packml_table_and_texts_are_the_studios(void)
{
    /* expected next state per command (Start, Hold, Stop, Reset), "-" = refused — shared/packml.ts */
    static const char *const X[PS_COUNT][4] = {
        {"-", "-", "-", "RESETTING"},           /* STOPPED */
        {"STARTING", "-", "STOPPING", "-"},     /* IDLE */
        {"-", "HOLDING", "STOPPING", "-"},      /* EXECUTE */
        {"-", "-", "STOPPING", "RESETTING"},    /* COMPLETE */
        {"UNHOLDING", "-", "STOPPING", "-"},    /* HELD */
        {"-", "-", "STOPPING", "-"},            /* SUSPENDED */
        {"-", "-", "-", "CLEARING"},            /* ABORTED */
        {"-", "-", "STOPPING", "-"},            /* RESETTING */
        {"-", "-", "STOPPING", "-"},            /* STARTING */
        {"-", "-", "STOPPING", "-"},            /* COMPLETING */
        {"-", "-", "STOPPING", "-"},            /* HOLDING */
        {"-", "-", "STOPPING", "-"},            /* UNHOLDING */
        {"-", "-", "STOPPING", "-"},            /* SUSPENDING */
        {"-", "-", "STOPPING", "-"},            /* UNSUSPENDING */
        {"-", "-", "-", "-"},                   /* STOPPING */
        {"-", "-", "-", "-"},                   /* ABORTING */
        {"-", "-", "-", "-"}};                  /* CLEARING */
    char why[160];
    for (int s = 0; s < PS_COUNT; s++)
        for (int c = 0; c < 4; c++) {
            PackState n = PS_COUNT;
            int rc = pack_command((PackState)s, (PackCmd)c, &n, why, sizeof why);
            char label[64];
            snprintf(label, sizeof label, "%s × %d", pack_state_name((PackState)s), c);
            if (str_eq(X[s][c], "-"))
                TEST_ASSERT_EQUAL_INT_MESSAGE(1, rc, label);
            else {
                TEST_ASSERT_EQUAL_INT_MESSAGE(0, rc, label);
                TEST_ASSERT_EQUAL_STRING_MESSAGE(X[s][c], pack_state_name(n), label);
            }
        }
    PackState n;
    pack_command(PS_EXECUTE, PC_START, &n, why, sizeof why);
    TEST_ASSERT_EQUAL_STRING("Start is not possible in EXECUTE (only in IDLE or HELD)", why);
    pack_command(PS_STOPPED, PC_STOP, &n, why, sizeof why);
    TEST_ASSERT_EQUAL_STRING("Stop is not possible in STOPPED (only in any state except STOPPED and the abort group)", why);
    TEST_ASSERT_EQUAL_INT(1, pack_mode_ok(PS_HELD, why, sizeof why));
    TEST_ASSERT_EQUAL_STRING("the mode can change only in STOPPED, IDLE or ABORTED (now HELD)", why);
    TEST_ASSERT_EQUAL_INT(0, pack_mode_ok(PS_IDLE, why, sizeof why));
    TEST_ASSERT_EQUAL_INT(0, pack_abort(PS_EXECUTE, &n));
    TEST_ASSERT_EQUAL_INT(PS_ABORTING, n);
    TEST_ASSERT_EQUAL_INT(1, pack_abort(PS_ABORTED, &n));
    TEST_ASSERT_EQUAL_INT(PS_EXECUTE, pack_settle(PS_UNHOLDING));
    TEST_ASSERT_EQUAL_INT(PS_STOPPED, pack_settle(PS_CLEARING));
    TEST_ASSERT_EQUAL_INT(-1, pack_mode_parse("auto")); /* case matters, as in the studio */
}

/* ---------------------------------------------------------------- U-36.4 alarm list */
static void test_U36_4_alarm_list_rule_raise_ack_clear(void)
{
    AlarmList l;
    memset(&l, 0, sizeof l);
    alarm_apply(&l, AL_RAISE, "W0310", "glue", 3, "1");
    alarm_apply(&l, AL_RAISE, "E1202", "plasma", 1, "2");
    alarm_apply(&l, AL_CLEAR, "W0310", NULL, 0, "3"); /* not acked: stays, inactive */
    TEST_ASSERT_EQUAL_UINT16(2, l.n);
    TEST_ASSERT_FALSE(alarm_has(&l, "W0310"));
    TEST_ASSERT_FALSE(alarm_find(&l, "W0310")->active);
    alarm_apply(&l, AL_ACK, "W0310", NULL, 0, "4"); /* acked after clear: gone */
    TEST_ASSERT_EQUAL_UINT16(1, l.n);
    alarm_apply(&l, AL_ACK, "E1202", NULL, 0, "5"); /* acked while active: stays, acked */
    TEST_ASSERT_TRUE(alarm_find(&l, "E1202")->acked);
    alarm_apply(&l, AL_RAISE, "W0310", "glue", 3, "6");
    alarm_apply(&l, AL_RAISE, "E1202", "plasma", 1, "7"); /* raised again: active, not acked, moves to the end */
    TEST_ASSERT_EQUAL_STRING("E1202", l.a[1].code);
    TEST_ASSERT_FALSE(l.a[1].acked);
    TEST_ASSERT_EQUAL_STRING("7", l.a[1].time);
    alarm_apply(&l, AL_CLEAR, "E1202", NULL, 0, "8");
    alarm_apply(&l, AL_ACK, "NOPE", NULL, 0, "9"); /* unknown: nothing */
    TEST_ASSERT_EQUAL_UINT16(2, l.n);
}

/* ---------------------------------------------------------------- U-36.5 the machine */
static EvRing g_ev;
static int next_ev(Ev *e) { return evr_pop(&g_ev, e) == 0; }
static Cmd cmd(CmdOp op, int32_t id)
{
    Cmd c;
    memset(&c, 0, sizeof c);
    c.op = (uint8_t)op;
    c.id = id;
    c.client = 1;
    return c;
}
static void test_U36_5_machine_commands_acting_states_alarm_demo_download_ack(void)
{
    static Machine m;
    Ev e;
    memset(&g_ev, 0, sizeof g_ev);
    machine_init(&m, &g_ev, 1);
    uint64_t t = 1000000;
    Cmd c = cmd(OP_RESET, 1);
    machine_cmd(&m, &c, t, NULL, NULL);
    TEST_ASSERT_TRUE(next_ev(&e)); /* the state first, then the answer (as the mock) */
    TEST_ASSERT_EQUAL_INT(EV_MACHINE, e.type);
    TEST_ASSERT_EQUAL_STRING("RESETTING", pack_state_name((PackState)e.state));
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(EV_RES, e.type);
    TEST_ASSERT_TRUE(e.ok);
    TEST_ASSERT_EQUAL_INT(1, e.id);
    machine_tick(&m, t + 799000);
    TEST_ASSERT_FALSE(next_ev(&e)); /* acting for 800 ms */
    machine_tick(&m, t + 800000);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(PS_IDLE, e.state);
    c = cmd(OP_HOLD, 2);
    machine_cmd(&m, &c, t, NULL, NULL);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_FALSE(e.ok);
    TEST_ASSERT_EQUAL_STRING("STATE", e.err);
    TEST_ASSERT_EQUAL_STRING("Hold is not possible in IDLE (only in EXECUTE)", e.msg);
    /* Start → EXECUTE; the demo: W0310 after 6 s, E1202 after 12 s → abort */
    t = 2000000;
    c = cmd(OP_START, 3);
    machine_cmd(&m, &c, t, NULL, NULL);
    while (next_ev(&e)) {}
    machine_tick(&m, t + 800000);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(PS_EXECUTE, e.state);
    uint64_t x = t + 800000;
    machine_tick(&m, x + 5999000);
    TEST_ASSERT_FALSE(next_ev(&e));
    machine_tick(&m, x + 6000000);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(EV_ALARM, e.type);
    TEST_ASSERT_EQUAL_INT(AL_RAISE, e.act);
    TEST_ASSERT_EQUAL_STRING("W0310", e.code);
    TEST_ASSERT_EQUAL_UINT8(3, e.priority);
    c = cmd(OP_ACK, 4);
    snprintf(c.code, sizeof c.code, "W0310");
    machine_cmd(&m, &c, x + 7000000, NULL, NULL);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(AL_ACK, e.act);
    TEST_ASSERT_EQUAL_STRING("unknown user", e.by);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_TRUE(e.ok);
    machine_cmd(&m, &c, x + 7100000, NULL, NULL); /* twice */
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_STRING("W0310 is already acknowledged", e.msg);
    machine_tick(&m, x + 12000000);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_STRING("E1202", e.code);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(PS_ABORTING, e.state);
    machine_tick(&m, x + 12800000);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(PS_ABORTED, e.state);
    machine_tick(&m, x + 16000000); /* W0310 clears itself 10 s after it came (acked → leaves the list) */
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(AL_CLEAR, e.act);
    TEST_ASSERT_NULL(alarm_find(&m.alarms, "W0310"));
    /* download only in STOPPED: refused programs go back to be freed */
    RtProg *p = (RtProg *)calloc(1, sizeof *p);
    snprintf(p->crc, sizeof p->crc, "8FF94EA7");
    c = cmd(OP_DOWNLOAD, 5);
    c.prog = p;
    machine_cmd(&m, &c, x + 17000000, NULL, NULL);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_STRING("download only in STOPPED (now ABORTED)", e.msg);
    TEST_ASSERT_EQUAL_PTR(p, e.free_me);
    /* Reset after the abort: CLEARING → STOPPED, which clears E1202 */
    c = cmd(OP_RESET, 6);
    machine_cmd(&m, &c, x + 18000000, NULL, NULL);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(PS_CLEARING, e.state);
    TEST_ASSERT_TRUE(next_ev(&e));
    machine_tick(&m, x + 18800000);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(PS_STOPPED, e.state);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(AL_CLEAR, e.act);
    TEST_ASSERT_EQUAL_STRING("E1202", e.code);
    c = cmd(OP_DOWNLOAD, 7);
    c.prog = p;
    machine_cmd(&m, &c, x + 19000000, NULL, NULL);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_TRUE(e.ok);
    TEST_ASSERT_EQUAL_STRING("8FF94EA7", e.crc);
    TEST_ASSERT_NULL(e.free_me); /* there was no old program */
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_STRING("8FF94EA7", e.prog); /* everyone sees the new program */
    /* mode: allowed in STOPPED */
    c = cmd(OP_MODE, 8);
    c.mode = PM_MANUAL;
    machine_cmd(&m, &c, x + 19100000, NULL, NULL);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(PM_MANUAL, e.mode);
    TEST_ASSERT_TRUE(next_ev(&e)); /* E1202 is still listed (cleared, not acked): STOPPED clears it again, as the mock */
    TEST_ASSERT_EQUAL_INT(EV_ALARM, e.type);
    TEST_ASSERT_EQUAL_INT(AL_CLEAR, e.act);
    TEST_ASSERT_TRUE(next_ev(&e));
    TEST_ASSERT_EQUAL_INT(EV_RES, e.type);
    TEST_ASSERT_TRUE(e.ok);
    TEST_ASSERT_EQUAL_UINT32(0, g_ev.lost);
    free(m.prog);
}

/* ---------------------------------------------------------------- U-36.6 program check */
static void test_U36_6_download_check_crc_of_the_studios_file(void)
{
    char *text = slurp(data_file("demo-program.rt.json")); /* compiled by the studio on the machine PC (step 34) */
    cJSON *rt = cJSON_Parse(text);
    RtProg p;
    char code[8];
    Err e = {""};
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, prog_verify(rt, &p, code, &e), e.msg);
    TEST_ASSERT_EQUAL_STRING("8FF94EA7", p.crc);
    TEST_ASSERT_EQUAL_STRING("D45C7CCE", p.tags_crc);
    TEST_ASSERT_EQUAL_UINT16(1, p.n_flows);
    TEST_ASSERT_EQUAL_UINT32(4, p.n_steps);
    char *again = rt_format(rt, "8FF94EA7"); /* the canonical text is the studio's file, byte for byte */
    TEST_ASSERT_EQUAL_STRING(text, again);
    free(again);
    cJSON_ReplaceItemInObject(cJSON_GetArrayItem(cJSON_GetObjectItem(cJSON_GetArrayItem(cJSON_GetObjectItem(rt, "flows"), 0), "steps"), 1), "tmo",
                              cJSON_CreateNumber(9000)); /* one value changed by hand */
    TEST_ASSERT_EQUAL_INT(1, prog_verify(rt, &p, code, &e));
    TEST_ASSERT_EQUAL_STRING("CRC", code);
    TEST_ASSERT_NOT_NULL(strstr(e.msg, "CRC mismatch: the file says 8FF94EA7, its flows give "));
    cJSON_ReplaceItemInObject(rt, "schema", cJSON_CreateString("spm.rt/2"));
    TEST_ASSERT_EQUAL_INT(1, prog_verify(rt, &p, code, &e));
    TEST_ASSERT_EQUAL_STRING("SCHEMA", code);
    TEST_ASSERT_EQUAL_STRING("schema must be \"spm.rt/1\", not \"spm.rt/2\"", e.msg);
    TEST_ASSERT_EQUAL_INT(1, prog_verify(NULL, &p, code, &e));
    TEST_ASSERT_EQUAL_STRING("schema must be \"spm.rt/1\", not null", e.msg);
    cJSON *bare = cJSON_Parse("{\"schema\":\"spm.rt/1\"}");
    TEST_ASSERT_EQUAL_INT(1, prog_verify(bare, &p, code, &e));
    TEST_ASSERT_EQUAL_STRING("flows, crc and tags_crc are required", e.msg);
    cJSON_Delete(bare);
    cJSON_Delete(rt);
    free(text);
}

/* ---------------------------------------------------------------- U-36.7 queue, ring, triple buffer */
static void test_U36_7_queue_ring_and_triple_buffer(void)
{
    static CmdQueue q;
    memset(&q, 0, sizeof q);
    Cmd c, out;
    memset(&c, 0, sizeof c);
    memset(&out, 0, sizeof out);
    for (int i = 0; i < CMDQ_N; i++) {
        c.id = i;
        TEST_ASSERT_EQUAL_INT(0, cmdq_push(&q, &c));
    }
    TEST_ASSERT_EQUAL_INT(1, cmdq_push(&q, &c)); /* full: refused, nothing overwritten */
    for (int i = 0; i < CMDQ_N; i++) {
        TEST_ASSERT_EQUAL_INT(0, cmdq_pop(&q, &out));
        TEST_ASSERT_EQUAL_INT(i, out.id); /* in order */
    }
    TEST_ASSERT_EQUAL_INT(1, cmdq_pop(&q, &out));
    static EvRing r;
    memset(&r, 0, sizeof r);
    Ev e, eo;
    memset(&e, 0, sizeof e);
    for (int i = 0; i < EVR_N + 3; i++) evr_push(&r, &e);
    TEST_ASSERT_EQUAL_UINT32(3, r.lost); /* never overwritten: a full ring counts what it could not take */
    int n = 0;
    while (!evr_pop(&r, &eo)) n++;
    TEST_ASSERT_EQUAL_INT(EVR_N, n);
    TagDB db;
    Err er = {""};
    TEST_ASSERT_EQUAL_INT(0, tagdb_load(demo("tags.json"), &A, &db, &er));
    ValueTriple t;
    TEST_ASSERT_EQUAL_INT(0, vtri_init(&t, db.n, &A));
    db.t[9].v.b = 1;
    vtri_publish(&t, &db);
    db.t[9].v.b = 0;
    vtri_publish(&t, &db); /* two publishes before a read: the reader gets the newest */
    TEST_ASSERT_EQUAL_UINT8(0, vtri_read(&t)[9].b);
    db.t[9].v.b = 1;
    vtri_publish(&t, &db);
    TEST_ASSERT_EQUAL_UINT8(1, vtri_read(&t)[9].b);
    TEST_ASSERT_EQUAL_UINT8(1, vtri_read(&t)[9].b); /* nothing new: the same copy */
    TEST_ASSERT_TRUE(t.back != t.front && t.back != (t.mid & 3u) && t.front != (t.mid & 3u)); /* three distinct buffers */
}

/* ---------------------------------------------------------------- U-36.8 a real WebSocket round trip */
static OsMutex g_rx_lock;
static char g_rx[64][2048];
static int g_n_rx;
static int on_rx(struct mg_connection *conn, int bits, char *data, size_t len, void *user)
{
    (void)conn, (void)user;
    if ((bits & 0x0f) != MG_WEBSOCKET_OPCODE_TEXT) return 1;
    os_mutex_lock(&g_rx_lock);
    if (g_n_rx < 64) snprintf(g_rx[g_n_rx++], sizeof g_rx[0], "%.*s", (int)len, data);
    os_mutex_unlock(&g_rx_lock);
    return 1;
}
static void on_rx_close(const struct mg_connection *conn, void *user) { (void)conn, (void)user; }
/* wait (pumping the server) until n frames have arrived; returns the count */
static int wait_rx(Comm *cm, int n)
{
    for (int k = 0; k < 400; k++) {
        comm_pump(cm);
        os_mutex_lock(&g_rx_lock);
        int got = g_n_rx;
        os_mutex_unlock(&g_rx_lock);
        if (got >= n) return got;
        os_sleep_ms(5);
    }
    return g_n_rx;
}
static int wait_cmd(CmdQueue *q, Cmd *c)
{
    for (int k = 0; k < 400; k++) {
        if (!cmdq_pop(q, c)) return 1;
        os_sleep_ms(5);
    }
    return 0;
}
static void test_log(const char *fmt, ...)
{
    va_list ap;
    va_start(ap, fmt);
    vprintf(fmt, ap);
    va_end(ap);
    printf("\n");
}
static void send_text(struct mg_connection *cl, const char *s) { mg_websocket_client_write(cl, MG_WEBSOCKET_OPCODE_TEXT, s, strlen(s)); }

static void test_U36_8_websocket_round_trip_connect_ping_command_download(void)
{
    static CmdQueue q;
    static EvRing r;
    static Machine m;
    memset(&q, 0, sizeof q);
    memset(&r, 0, sizeof r);
    os_mutex_init(&g_rx_lock);
    g_n_rx = 0;
    TagDB db;
    Err e = {""};
    TEST_ASSERT_EQUAL_INT(0, tagdb_load(demo("tags.json"), &A, &db, &e));
    ValueTriple vt;
    TEST_ASSERT_EQUAL_INT(0, vtri_init(&vt, db.n, &A));
    vtri_publish(&vt, &db);
    machine_init(&m, &r, 0);
    volatile uint32_t cmax = 1042;
    CommConf cc = {17600, "0.3.0-test", 1000, &cmax, &db, &q, &r, &vt, test_log};
    Comm *cm = comm_start(&cc, &e);
    TEST_ASSERT_NOT_NULL_MESSAGE(cm, e.msg);
    Comm *twice = comm_start(&cc, &e); /* the port is taken: a clear reason (exit code 6) */
    TEST_ASSERT_NULL(twice);
    TEST_ASSERT_NOT_NULL(strstr(e.msg, "cannot listen on 127.0.0.1:17600"));

    char err[256] = "";
    struct mg_connection *cl = mg_connect_websocket_client("127.0.0.1", 17600, 0, err, sizeof err, "/", NULL, on_rx, on_rx_close, NULL);
    TEST_ASSERT_NOT_NULL_MESSAGE(cl, err);
    TEST_ASSERT_EQUAL_INT(3, wait_rx(cm, 3)); /* on connect: state, machine, alarms — as the mock */
    TEST_ASSERT_EQUAL_STRING_LEN("{\"t\":\"state\",", g_rx[0], 13);
    TEST_ASSERT_NOT_NULL(strstr(g_rx[1], "\"ev\":\"machine\"") );
    TEST_ASSERT_NOT_NULL(strstr(g_rx[1], "\"state\":\"STOPPED\",\"mode\":\"Auto\",\"prog\":null"));
    TEST_ASSERT_NOT_NULL(strstr(g_rx[2], "\"ev\":\"alarms\",\"list\":[]"));
    TEST_ASSERT_EQUAL_UINT32(1, comm_clients(cm));

    send_text(cl, "{\"t\":\"ping\"}");
    TEST_ASSERT_EQUAL_INT(4, wait_rx(cm, 4));
    TEST_ASSERT_EQUAL_STRING("{\"t\":\"pong\",\"version\":\"0.3.0-test\",\"cycle_us\":1000,\"cycle_max_us\":1042}", g_rx[3]);

    send_text(cl, "{\"t\":\"cmd\",\"id\":21,\"op\":\"reset\"}"); /* → queue → (the RT cycle) → events → studio */
    Cmd c;
    TEST_ASSERT_TRUE(wait_cmd(&q, &c));
    TEST_ASSERT_EQUAL_INT(OP_RESET, c.op);
    TEST_ASSERT_EQUAL_INT(21, c.id);
    machine_cmd(&m, &c, os_now_us(), &db, NULL);
    TEST_ASSERT_EQUAL_INT(6, wait_rx(cm, 6));
    TEST_ASSERT_NOT_NULL(strstr(g_rx[4], "\"state\":\"RESETTING\""));
    TEST_ASSERT_EQUAL_STRING("{\"t\":\"res\",\"id\":21,\"ok\":true}", g_rx[5]);

    send_text(cl, "{\"t\":\"cmd\",\"id\":22,\"op\":\"fly\"}"); /* answered on the comm side */
    TEST_ASSERT_EQUAL_INT(7, wait_rx(cm, 7));
    TEST_ASSERT_EQUAL_STRING("{\"t\":\"res\",\"id\":22,\"ok\":false,\"err\":\"UNKNOWN_OP\",\"msg\":\"op 'fly' not supported\"}", g_rx[6]);

    /* download: the studio's file, wrapped in a command; the CRC is checked before the RT cycle sees it */
    char *prog = slurp(data_file("demo-program.rt.json"));
    size_t n = strlen(prog) + 64;
    char *msg = (char *)malloc(n);
    snprintf(msg, n, "{\"t\":\"cmd\",\"id\":23,\"op\":\"download\",\"rt\":%s}", prog);
    m.state = PS_STOPPED;
    send_text(cl, msg);
    TEST_ASSERT_TRUE(wait_cmd(&q, &c));
    TEST_ASSERT_EQUAL_INT(OP_DOWNLOAD, c.op);
    TEST_ASSERT_EQUAL_STRING("8FF94EA7", c.prog->crc);
    machine_cmd(&m, &c, os_now_us(), &db, NULL);
    TEST_ASSERT_EQUAL_INT(9, wait_rx(cm, 9));
    TEST_ASSERT_EQUAL_STRING("{\"t\":\"res\",\"id\":23,\"ok\":true,\"crc\":\"8FF94EA7\"}", g_rx[7]);
    TEST_ASSERT_NOT_NULL(strstr(g_rx[8], "\"prog\":\"8FF94EA7\""));
    char *bad = strstr(msg, "\"tmo\":5000");
    TEST_ASSERT_NOT_NULL(bad);
    memcpy(bad, "\"tmo\":5001", 10); /* one digit changed */
    send_text(cl, msg);
    TEST_ASSERT_EQUAL_INT(10, wait_rx(cm, 10));
    TEST_ASSERT_NOT_NULL(strstr(g_rx[9], "\"ok\":false,\"err\":\"CRC\""));

    /* values: a changed tag reaches the studio in the next state frame */
    db.t[9].v.b = 1;
    vtri_publish(&vt, &db);
    TEST_ASSERT_EQUAL_INT(11, wait_rx(cm, 11));
    TEST_ASSERT_NOT_NULL(strstr(g_rx[10], "\"v\":{\"9\":true}"));

    mg_close_connection(cl);
    for (int k = 0; k < 100 && comm_clients(cm); k++) os_sleep_ms(5);
    TEST_ASSERT_EQUAL_UINT32(0, comm_clients(cm));
    comm_stop(cm);
    free(m.prog);
    free(msg);
    free(prog);
    os_mutex_free(&g_rx_lock);
}

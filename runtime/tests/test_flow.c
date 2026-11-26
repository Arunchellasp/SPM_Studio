/*
 * Unity tests of step 37 (included by test_runtime.c): the flow engine.
 *   U-37.1 axes, points and alarms from tags.json · U-37.2 the step table and what it refuses · U-37.3 RPN = the studio's
 *   U-37.4 each op handler on the SimCard · U-37.5 the demo flow runs 1000 cycles · U-37.6 Stop is instant, Hold resumes
 *   U-37.7 program.rt.json at start-up · U-37.8 pc in state frames, step events
 *
 * The rig runs the RT cycle's steps 1 … 5 by hand, 1 ms per tick of simulated time: exact and fast.
 */

typedef struct Rig {
    RtConfig c;
    TagDB db;
    Card card;
    IoMap io;
    Machine m;
    EvRing ev;
    uint64_t now;
} Rig;
static Rig R;

static void rig_init(void)
{
    Err e = {""};
    memset(&R, 0, sizeof R);
    TEST_ASSERT_EQUAL_INT(0, cfg_load(demo("config.json"), &R.c, &e));
    TEST_ASSERT_EQUAL_INT(0, tagdb_load(demo("tags.json"), &A, &R.db, &e));
    TEST_ASSERT_EQUAL_INT(0, card_open(&R.card, &R.c, &e));
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, io_map_bind(&R.db, &R.card, &A, &R.io, &e), e.msg);
    machine_init(&R.m, &R.ev, 0);
    machine_bind(&R.m, &R.db, &R.card);
    R.now = 1000000;
    io_read_inputs(&R.db, &R.card, &R.io, 0);
}
/* one RT cycle (design 5b) of 1 ms: inputs → (commands: rig_cmd) → flows → machine → outputs */
static void tick(int n)
{
    for (int i = 0; i < n; i++) {
        R.now += 1000;
        R.card.vt->read_inputs(&R.card, 1000);
        io_read_inputs(&R.db, &R.card, &R.io, (uint32_t)(R.now / 1000u));
        R.card.vt->axes_update(&R.card, 1000);
        machine_flows(&R.m, R.now);
        machine_tick(&R.m, R.now);
        io_write_outputs(&R.db, &R.card, &R.io);
    }
}
static void rig_cmd(CmdOp op)
{
    Cmd c;
    memset(&c, 0, sizeof c);
    c.op = (uint8_t)op;
    machine_cmd(&R.m, &c, R.now, &R.db, &R.card);
}
static void drain(void)
{
    Ev e;
    while (!evr_pop(&R.ev, &e)) {}
}
static void to_execute(void)
{
    rig_cmd(OP_RESET);
    tick(800);
    rig_cmd(OP_START);
    tick(800);
    TEST_ASSERT_EQUAL_STRING("EXECUTE", pack_state_name(R.m.state));
}
/* a one-flow program from its steps, built against the demo tags */
static Prog *prog_of(const char *steps, char code[8], Err *e)
{
    char *text = (char *)malloc(strlen(steps) + 300);
    sprintf(text, "{\"schema\":\"spm.rt/1\",\"crc\":\"00000000\",\"tags_crc\":\"%08X\",\"flows\":[{\"name\":\"T\",\"id\":0,\"station\":\"S1\","
                  "\"autostart\":false,\"steps\":[%s]}]}",
            R.db.crc, steps);
    cJSON *rt = cJSON_Parse(text);
    TEST_ASSERT_NOT_NULL_MESSAGE(rt, text);
    Prog *p = NULL;
    prog_build(rt, &R.db, &p, code, e);
    cJSON_Delete(rt);
    free(text);
    return p;
}
static Prog *prog_ok(const char *steps)
{
    char code[8];
    Err e = {""};
    Prog *p = prog_of(steps, code, &e);
    TEST_ASSERT_NOT_NULL_MESSAGE(p, e.msg);
    return p;
}
static void refused(const char *steps, const char *want)
{
    char code[8];
    Err e = {""};
    Prog *p = prog_of(steps, code, &e);
    TEST_ASSERT_NULL(p);
    TEST_ASSERT_EQUAL_STRING("PROGRAM", code);
    TEST_ASSERT_NOT_NULL_MESSAGE(strstr(e.msg, want), e.msg);
}
static int id_of(const char *name) { return tagdb_find(&R.db, name); }

/* ---------------------------------------------------------------- U-37.1 */
static void test_U37_1_axes_points_and_alarms_from_tags_json(void)
{
    rig_init();
    const Tag *x = &R.db.t[id_of("AX_S1_X")], *pick = &R.db.t[id_of("P_S1_Pick")], *al = &R.db.t[id_of("A_301_NoPart")];
    TEST_ASSERT_NOT_NULL(x->axis);
    TEST_ASSERT_EQUAL_FLOAT(500.0f, x->axis->vmax);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, x->axis->soft_min);
    TEST_ASSERT_EQUAL_FLOAT(600.0f, x->axis->soft_max);
    TEST_ASSERT_EQUAL_UINT8(2, pick->point->n);
    TEST_ASSERT_EQUAL_UINT16(id_of("AX_S1_X"), pick->point->axis[0]);
    TEST_ASSERT_EQUAL_UINT16(id_of("AX_S1_Z"), pick->point->axis[1]);
    TEST_ASSERT_EQUAL_FLOAT(120.0f, pick->point->val[0]);
    TEST_ASSERT_EQUAL_FLOAT(85.5f, pick->point->val[1]);
    TEST_ASSERT_EQUAL_STRING("A301", al->alarm->code);
    TEST_ASSERT_EQUAL_STRING("No part on nest after pick", al->alarm->text);
    TEST_ASSERT_EQUAL_UINT8(2, al->alarm->priority);
    TEST_ASSERT_EQUAL_UINT8(AR_PAUSE, al->alarm->reaction);
    /* a point naming something that is not an axis is refused at load */
    FILE *f = fopen("t_pt.json", "wb");
    fputs("{\"schema\":\"spm.tags/1\",\"tags\":[{\"name\":\"R\",\"kind\":\"REG\",\"dtype\":\"INT\"},"
          "{\"name\":\"P\",\"kind\":\"POINT\",\"dtype\":\"REAL\",\"axes\":[\"R\"],\"values\":[1]}]}",
          f);
    fclose(f);
    TagDB db;
    Err e = {""};
    TEST_ASSERT_EQUAL_INT(2, tagdb_load("t_pt.json", &A, &db, &e));
    TEST_ASSERT_NOT_NULL_MESSAGE(strstr(e.msg, "point \"P\": \"R\" is not an axis"), e.msg);
}

/* ---------------------------------------------------------------- U-37.2 */
static void test_U37_2_step_table_from_the_demo_and_what_it_refuses(void)
{
    rig_init();
    Err e = {""};
    Prog *p = NULL;
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, prog_load_file(demo("program.rt.json"), &R.db, &p, &e), e.msg);
    TEST_ASSERT_EQUAL_STRING("20D80EEF", p->meta.crc);
    TEST_ASSERT_EQUAL_UINT16(1, p->n_flows);
    TEST_ASSERT_EQUAL_UINT16(9, p->flow[0].n);
    TEST_ASSERT_EQUAL_INT(SO_MOVE_ABS, p->steps[3].op);
    TEST_ASSERT_EQUAL_FLOAT(120.0f, p->steps[3].target); /* P_S1_Pick for AX_S1_X, resolved at load */
    TEST_ASSERT_EQUAL_FLOAT(480.0f, p->steps[7].target);
    TEST_ASSERT_EQUAL_UINT16(id_of("A_301_NoPart"), p->steps[2].alarm);
    TEST_ASSERT_EQUAL_STRING("closed", p->steps[2].src);
    free(p);
    /* built for other tags */
    cJSON *rt = cJSON_Parse("{\"schema\":\"spm.rt/1\",\"crc\":\"0\",\"tags_crc\":\"12345678\",\"flows\":[]}");
    char code[8];
    TEST_ASSERT_EQUAL_INT(1, prog_build(rt, &R.db, &p, code, &e));
    TEST_ASSERT_EQUAL_STRING("TAGS", code);
    TEST_ASSERT_NOT_NULL(strstr(e.msg, "built for tags 12345678, the runtime has D45C7CCE"));
    cJSON_Delete(rt);
    /* every kind of mistake, with the step and the reason */
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"SET_DO\",\"tag\":9,\"val\":1,\"next\":0}", "DI_S1_PartPresent is a DI — SET_DO needs a DO");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"WAIT_DI\",\"tag\":11,\"val\":1,\"tmo\":0,\"next\":0}", "WAIT_DI needs a DI or a BOOL register");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"START\",\"next\":5}", "\"next\" must be a step of this flow (0 … 0)");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"MOVE_ABS\",\"axis\":9,\"point\":14,\"spd\":50,\"next\":0}", "\"axis\" must be an AXIS on the card");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"MOVE_ABS\",\"axis\":2,\"point\":11,\"spd\":50,\"next\":0}", "\"point\" must be a POINT");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"MOVE_ABS\",\"axis\":2,\"point\":14,\"spd\":0,\"next\":0}", "\"spd\" must be 1 … 100");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"JUMP\",\"next\":0}", "unknown op");
    refused("{\"i\":3,\"src\":\"a\",\"op\":\"START\",\"next\":0}", "\"i\" must be 0");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"IF\",\"rpn\":[\"T:17\",\"GE\"],\"yes\":0,\"no\":0}", "RPN takes from an empty stack at \"GE\"");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"IF\",\"rpn\":[\"T:17\",\"K:1\"],\"yes\":0,\"no\":0}", "RPN leaves 2 values");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"IF\",\"rpn\":[\"T:999\"],\"yes\":0,\"no\":0}", "RPN \"T:999\" is not a tag id");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"IF\",\"rpn\":[\"T:17\",\"K:1\",\"POW\"],\"yes\":0,\"no\":0}", "RPN \"POW\" is unknown");
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"WAIT_DI\",\"tag\":9,\"val\":1,\"tmo\":100,\"alarm\":11,\"next\":0}", "\"alarm\" must be an ALARM tag");
    /* a point outside the axis' soft limits */
    R.db.t[id_of("P_S1_Pick")].point->val[0] = 700.0f;
    refused("{\"i\":0,\"src\":\"a\",\"op\":\"MOVE_ABS\",\"axis\":2,\"point\":14,\"spd\":50,\"next\":0}", "P_S1_Pick = 700 is outside the soft limits of AX_S1_X (0 … 600)");
}

/* ---------------------------------------------------------------- U-37.3 */
static double rpn_of(const char *toks)
{
    char steps[512];
    snprintf(steps, sizeof steps, "{\"i\":0,\"src\":\"a\",\"op\":\"IF\",\"rpn\":[%s],\"yes\":0,\"no\":0}", toks);
    Prog *p = prog_ok(steps);
    double v = rpn_eval(p->rpn, p->steps[0].rpn_n, &R.db);
    free(p);
    return v;
}
static void test_U37_3_rpn_gives_what_the_studios_evalRpn_gives(void)
{
    rig_init();
    R.db.t[17].v.i = 120; /* R_PartCount */
    R.db.t[9].v.b = 1;    /* DI_S1_PartPresent */
    R.db.t[0].v.f = 21.5f; /* AI_Sealer_Temp */
    TEST_ASSERT_EQUAL_DOUBLE(1.0, rpn_of("\"T:17\",\"K:100\",\"GE\""));
    TEST_ASSERT_EQUAL_DOUBLE(0.0, rpn_of("\"T:17\",\"K:100\",\"LT\""));
    TEST_ASSERT_EQUAL_DOUBLE(1.0, rpn_of("\"T:9\",\"T:17\",\"K:120\",\"EQ\",\"AND\""));
    TEST_ASSERT_EQUAL_DOUBLE(0.0, rpn_of("\"T:9\",\"NOT\""));
    TEST_ASSERT_EQUAL_DOUBLE(1.0, rpn_of("\"K:0\",\"T:9\",\"OR\""));
    TEST_ASSERT_EQUAL_DOUBLE(43.0, rpn_of("\"T:0\",\"K:2\",\"MUL\""));
    TEST_ASSERT_EQUAL_DOUBLE(-5.0, rpn_of("\"K:5\",\"NEG\""));
    TEST_ASSERT_EQUAL_DOUBLE(0.0, rpn_of("\"T:17\",\"K:0\",\"DIV\"")); /* ÷ 0 = 0, as the studio: no exception in the cycle */
    TEST_ASSERT_EQUAL_DOUBLE(1.0, rpn_of("\"T:17\",\"K:20\",\"SUB\",\"K:100\",\"NE\",\"NOT\""));
}

/* ---------------------------------------------------------------- U-37.4 */
static void test_U37_4_each_op_handler_on_the_simcard(void)
{
    rig_init();
    /* START → SET_DO → WAIT_DI (closed, A301 after 300 ms) → DELAY 250 → MOVE_ABS X Pick 50 % → IF R_PartCount >= 1 yes:END no:SET_DO off → END */
    Prog *p = prog_ok("{\"i\":0,\"src\":\"s\",\"op\":\"START\",\"next\":1},"
                      "{\"i\":1,\"src\":\"on\",\"op\":\"SET_DO\",\"tag\":11,\"val\":1,\"next\":2},"
                      "{\"i\":2,\"src\":\"w\",\"op\":\"WAIT_DI\",\"tag\":7,\"val\":1,\"tmo\":300,\"alarm\":4,\"next\":3},"
                      "{\"i\":3,\"src\":\"d\",\"op\":\"DELAY\",\"ms\":250,\"next\":4},"
                      "{\"i\":4,\"src\":\"m\",\"op\":\"MOVE_ABS\",\"axis\":2,\"point\":14,\"spd\":50,\"next\":5},"
                      "{\"i\":5,\"src\":\"if\",\"op\":\"IF\",\"rpn\":[\"T:17\",\"K:1\",\"GE\"],\"yes\":7,\"no\":6},"
                      "{\"i\":6,\"src\":\"off\",\"op\":\"SET_DO\",\"tag\":11,\"val\":0,\"next\":7},"
                      "{\"i\":7,\"src\":\"e\",\"op\":\"END\"}");
    machine_start_program(&R.m, p, R.now);
    to_execute(); /* Reset put every flow at its Start */
    TEST_ASSERT_EQUAL_UINT16(0, R.m.inst[0].pc);
    tick(1); /* START: done in its first cycle */
    TEST_ASSERT_EQUAL_UINT16(1, R.m.inst[0].pc);
    tick(1); /* SET_DO: the tag, and the card output at the end of the same cycle */
    TEST_ASSERT_EQUAL_UINT16(2, R.m.inst[0].pc);
    TEST_ASSERT_EQUAL_UINT8(1, R.db.t[11].v.b);
    TEST_ASSERT_EQUAL_UINT8(1, R.card.dout[R.db.t[11].io]);
    /* WAIT_DI: the clamp needs 200 ms (cylinder model) — the step waits, then goes on */
    tick(150);
    TEST_ASSERT_EQUAL_UINT16(2, R.m.inst[0].pc);
    int w = 0;
    while (R.m.inst[0].pc == 2 && w < 100) tick(1), w++;
    TEST_ASSERT_EQUAL_UINT16(3, R.m.inst[0].pc);
    TEST_ASSERT_TRUE(w > 45 && w < 60); /* the sensor came ~200 ms after the valve */
    TEST_ASSERT_NULL(alarm_find(&R.m.alarms, "A301")); /* in time: no alarm */
    /* DELAY 250 ms, to the millisecond */
    tick(249);
    TEST_ASSERT_EQUAL_UINT16(3, R.m.inst[0].pc);
    tick(1);
    TEST_ASSERT_EQUAL_UINT16(4, R.m.inst[0].pc);
    /* MOVE_ABS: X 0 → 120 at 50 % of 500 = 250 mm/s → 480 ms; issued once, done when in position */
    tick(2);
    TEST_ASSERT_TRUE(R.card.ax[R.db.t[2].io].moving);
    TEST_ASSERT_EQUAL_DOUBLE(250.0, R.card.ax[R.db.t[2].io].vel);
    w = 2;
    while (R.m.inst[0].pc == 4 && w < 1000) tick(1), w++;
    TEST_ASSERT_EQUAL_UINT16(5, R.m.inst[0].pc);
    TEST_ASSERT_TRUE(w >= 480 && w <= 483);
    TEST_ASSERT_EQUAL_DOUBLE(120.0, R.card.ax[R.db.t[2].io].pos);
    /* IF R_PartCount >= 1: 0 → no → the SET_DO off */
    tick(1);
    TEST_ASSERT_EQUAL_UINT16(6, R.m.inst[0].pc);
    tick(1);
    TEST_ASSERT_EQUAL_UINT8(0, R.db.t[11].v.b);
    TEST_ASSERT_EQUAL_UINT16(7, R.m.inst[0].pc);
    /* END: a cycle, back to Start */
    tick(1);
    TEST_ASSERT_EQUAL_UINT16(0, R.m.inst[0].pc);
    TEST_ASSERT_EQUAL_UINT32(1, R.m.inst[0].cycles);
    /* second round: the clamp cannot close (the test keeps its valve off) → WAIT_DI times out after 300 ms */
    tick(1); /* START */
    for (int i = 0; i < 320; i++) {
        R.db.t[11].v.b = 0;
        tick(1);
    }
    TEST_ASSERT_EQUAL_UINT16(2, R.m.inst[0].pc);
    const AlarmEntry *a = alarm_find(&R.m.alarms, "A301");
    TEST_ASSERT_NOT_NULL(a); /* the timeout raised the step's alarm … */
    TEST_ASSERT_EQUAL_UINT8(2, a->priority);
    TEST_ASSERT_EQUAL_STRING("HOLDING", pack_state_name(R.m.state)); /* … with the tag's reaction: pause */
    tick(800);
    TEST_ASSERT_EQUAL_STRING("HELD", pack_state_name(R.m.state));
    R.db.t[11].v.b = 1; /* the operator fixed it: the valve closes the clamp … */
    rig_cmd(OP_START);  /* … and continues */
    tick(900);
    TEST_ASSERT_EQUAL_STRING("EXECUTE", pack_state_name(R.m.state));
    TEST_ASSERT_TRUE(R.m.inst[0].pc >= 3);
    TEST_ASSERT_FALSE(alarm_has(&R.m.alarms, "A301")); /* the input came: the alarm cleared */
    free(R.m.prog);
}

/* ---------------------------------------------------------------- U-37.5 */
static void test_U37_5_the_demo_flow_runs_1000_cycles_on_the_simcard(void)
{
    rig_init();
    Err e = {""};
    Prog *p = NULL;
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, prog_load_file(demo("program.rt.json"), &R.db, &p, &e), e.msg);
    machine_start_program(&R.m, p, R.now);
    to_execute();
    uint64_t t0 = R.now;
    long ticks = 0;
    uint32_t steps = 0;
    Ev ev;
    while (R.m.inst[0].cycles < 1000 && ticks < 3000000) {
        tick(1);
        ticks++;
        while (!evr_pop(&R.ev, &ev))
            if (ev.type == EV_STEP) steps++;
            else if (ev.type == EV_ALARM) TEST_FAIL_MESSAGE("no alarm may come in 1000 good cycles");
    }
    double s = (double)(R.now - t0) / 1e6;
    printf("demo flow: %u cycles in %.1f s simulated (%.3f s per cycle), %u step events, R_PartCount untouched\n", R.m.inst[0].cycles, s,
           s / R.m.inst[0].cycles, steps);
    TEST_ASSERT_EQUAL_UINT32(1000, R.m.inst[0].cycles);
    TEST_ASSERT_EQUAL_UINT32(1000u * 9u + 2u, steps); /* 9 per cycle, every change reported (+ 'at Start' on load and on Reset) */
    TEST_ASSERT_TRUE(s / 1000.0 > 1.9 && s / 1000.0 < 2.1); /* 2 × 200 ms clamp, 2 × 720 ms move, 100 ms dwell, 9 × 1 ms */
    TEST_ASSERT_EQUAL_UINT32(0, R.ev.lost);
    free(R.m.prog);
}

/* ---------------------------------------------------------------- U-37.6 */
static void test_U37_6_stop_is_instant_hold_resumes_the_move(void)
{
    rig_init();
    Err e = {""};
    Prog *p = NULL;
    TEST_ASSERT_EQUAL_INT(0, prog_load_file(demo("program.rt.json"), &R.db, &p, &e));
    machine_start_program(&R.m, p, R.now);
    to_execute();
    while (R.m.inst[0].pc != 3) tick(1); /* MOVE_ABS to Pick */
    tick(100);
    CardAxis *x = &R.card.ax[R.db.t[2].io];
    TEST_ASSERT_TRUE(x->moving);
    /* Hold: the axis stops where it is; Start: the same move is issued again and finishes */
    rig_cmd(OP_HOLD);
    double held = x->pos;
    tick(1);
    TEST_ASSERT_FALSE(x->moving);
    tick(900);
    TEST_ASSERT_EQUAL_DOUBLE(held, x->pos);
    TEST_ASSERT_EQUAL_UINT16(3, R.m.inst[0].pc);
    rig_cmd(OP_START);
    tick(800 + 400);
    TEST_ASSERT_TRUE(R.m.inst[0].pc > 3); /* reached Pick after the resume */
    while (R.m.inst[0].pc != 7) tick(1); /* MOVE_ABS to Place */
    tick(200);
    TEST_ASSERT_EQUAL_UINT8(0, R.db.t[11].v.b);
    R.db.t[11].v.b = 1; /* make an output visible: it must go off with the Stop */
    io_write_outputs(&R.db, &R.card, &R.io);
    drain();
    /* Stop in the middle of the move: in this very cycle no flow runs, the axis stops, the outputs go off */
    double before = x->pos;
    rig_cmd(OP_STOP);
    TEST_ASSERT_FALSE(x->moving);
    TEST_ASSERT_EQUAL_UINT8(0, R.db.t[11].v.b);
    tick(1);
    TEST_ASSERT_EQUAL_UINT8(0, R.card.dout[R.db.t[11].io]);
    tick(5000);
    TEST_ASSERT_EQUAL_DOUBLE(before, x->pos); /* not one more micrometre */
    TEST_ASSERT_EQUAL_UINT16(7, R.m.inst[0].pc); /* the flow stands where it was stopped */
    TEST_ASSERT_EQUAL_STRING("STOPPED", pack_state_name(R.m.state));
    Ev ev;
    int log = 0, steps = 0;
    while (!evr_pop(&R.ev, &ev)) {
        if (ev.type == EV_LOG && strstr(ev.msg, "flows halted in the same cycle")) log = 1;
        if (ev.type == EV_STEP) steps++;
    }
    TEST_ASSERT_TRUE(log);
    TEST_ASSERT_EQUAL_INT(0, steps);
    /* Reset: every flow back to its Start */
    rig_cmd(OP_RESET);
    TEST_ASSERT_EQUAL_UINT16(0, R.m.inst[0].pc);
    free(R.m.prog);
}

/* ---------------------------------------------------------------- U-37.7 */
static void test_U37_7_program_at_start_up_missing_or_refused(void)
{
    rig_init();
    Err e = {""};
    Prog *p = NULL;
    TEST_ASSERT_EQUAL_INT(1, prog_load_file("no_such_program.rt.json", &R.db, &p, &e)); /* no file: no program, not an error */
    TEST_ASSERT_NULL(p);
    FILE *f = fopen("t_bad.rt.json", "wb");
    fputs("{\"schema\":\"spm.rt/1\",\"crc\":\"00000000\",\"tags_crc\":\"D45C7CCE\",\"flows\":[]}", f);
    fclose(f);
    TEST_ASSERT_EQUAL_INT(7, prog_load_file("t_bad.rt.json", &R.db, &p, &e));
    TEST_ASSERT_NOT_NULL_MESSAGE(strstr(e.msg, "refused (CRC): CRC mismatch"), e.msg);
    /* loaded at start-up: the machine event carries the program, so the link side (and every studio) knows it */
    TEST_ASSERT_EQUAL_INT(0, prog_load_file(demo("program.rt.json"), &R.db, &p, &e));
    drain();
    machine_start_program(&R.m, p, R.now);
    Ev ev;
    int seen = 0;
    while (!evr_pop(&R.ev, &ev))
        if (ev.type == EV_MACHINE && str_eq(ev.prog, "20D80EEF")) seen = 1;
    TEST_ASSERT_TRUE_MESSAGE(seen, "machine event with the program's CRC after start-up loading (found by UI-37.5)");
    free(R.m.prog);
}

/* ---------------------------------------------------------------- U-37.8 */
static void test_U37_8_pc_in_state_frames_and_step_events(void)
{
    rig_init();
    uint16_t pc[2] = {3, 0};
    Value *v = (Value *)calloc(R.db.n, sizeof *v);
    ASSERT_JSON("{\"t\":\"state\",\"seq\":4,\"v\":{},\"pc\":{\"0\":3,\"1\":0}}", msg_state(4, &R.db, v, v, pc, 2));
    ASSERT_JSON("{\"t\":\"evt\",\"ev\":\"step\",\"ts\":7,\"flow\":0,\"pc\":3}", msg_step(7, 0, 3));
    ValueTriple t;
    TEST_ASSERT_EQUAL_INT(0, vtri_init(&t, R.db.n, &A));
    vtri_publish(&t, &R.db, pc, 2);
    vtri_read(&t);
    uint8_t nf = 0;
    const uint16_t *got = vtri_pcs(&t, &nf);
    TEST_ASSERT_EQUAL_UINT8(2, nf);
    TEST_ASSERT_EQUAL_UINT16(3, got[0]);
    free(v);
}

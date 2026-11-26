/*
 * Unity tests of the runtime. Step 35: config and tag loading, SimCard model, jitter statistics, the RT thread.
 * Step 36 (test_link.c): messages, PackML, alarms, the machine, the download check, queues, a WebSocket round trip.
 * Step 37 (test_flow.c): the flow engine — op handlers, the demo flow 1000 cycles, instant stop.
 * Built from the same unity build as spm_rt (src/spm_rt_all.c); ctest runs them (CI on Windows and Linux).
 */
#ifdef _WIN32
#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#endif
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "unity.h"
#include "spm_rt_all.c"

/* the demo project: compiled-in path, or SPM_PROJECTS (e.g. on the machine PC, where the build path does not exist) */
static char g_demo[512];
static const char *demo(const char *file)
{
    static char p[4][600];
    static int k;
    k = (k + 1) % 4;
    snprintf(p[k], sizeof p[k], "%s/demo/%s", g_demo, file);
    return p[k];
}

static Arena A;
void setUp(void)
{
    TEST_ASSERT_EQUAL_INT(0, arena_init(&A, 8u << 20));
}
void tearDown(void)
{
    arena_free(&A);
}

/* write a test file next to the test binary (ctest runs it in the build folder) */
static const char *put(const char *name, const char *text)
{
    FILE *f = fopen(name, "wb");
    TEST_ASSERT_NOT_NULL(f);
    fputs(text, f);
    fclose(f);
    return name;
}

/* ---------------------------------------------------------------- U-35.1 config.json */
static void test_U35_1_config_loads_with_defaults_and_refuses_mistakes(void)
{
    RtConfig c;
    Err e = {""};
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, cfg_load(demo("config.json"), &c, &e), e.msg);
    TEST_ASSERT_EQUAL_UINT32(1000, c.cycle_us);
    TEST_ASSERT_EQUAL_STRING("sim", c.card);
    TEST_ASSERT_EQUAL_UINT32(200, c.sim_cyl_ms);
    TEST_ASSERT_NOT_NULL(strstr(c.tags_path, "demo/tags.json")); /* relative to the folder of config.json */
    TEST_ASSERT_NOT_NULL(strstr(c.log_path, "demo/logs/spm_rt.log"));

    TEST_ASSERT_EQUAL_INT(0, cfg_load(put("c_min.json", "{\"schema\":\"spm.config/1\"}"), &c, &e)); /* all defaults */
    TEST_ASSERT_EQUAL_UINT32(1000, c.cycle_us);
    TEST_ASSERT_EQUAL_UINT32(10, c.stats_s);
    TEST_ASSERT_EQUAL_INT(-1, c.cpu);

    TEST_ASSERT_NOT_EQUAL(0, cfg_load(put("c1.json", "{\"schema\":\"spm.config/1\",\"cycle_us\":100}"), &c, &e));
    TEST_ASSERT_EQUAL_STRING("c1.json: \"cycle_us\" must be 250 … 10000 (is 100)", e.msg);
    TEST_ASSERT_NOT_EQUAL(0, cfg_load(put("c2.json", "{\"schema\":\"spm.config/1\",\"cylce_us\":1000}"), &c, &e));
    TEST_ASSERT_EQUAL_STRING("c2.json: unknown setting \"cylce_us\"", e.msg); /* a typo is not ignored */
    TEST_ASSERT_NOT_EQUAL(0, cfg_load(put("c3.json", "{\"schema\":\"spm.config/1\",\"cycle_us\":500,\"spin_us\":500}"), &c, &e));
    TEST_ASSERT_EQUAL_STRING("c3.json: \"spin_us\" (500) must be less than \"cycle_us\" (500)", e.msg);
    TEST_ASSERT_NOT_EQUAL(0, cfg_load(put("c4.json", "{\"schema\":\"spm.config/1\",\"card\":\"gts\"}"), &c, &e));
    TEST_ASSERT_EQUAL_STRING("c4.json: card \"gts\" is not in this runtime yet (only \"sim\")", e.msg);
    TEST_ASSERT_NOT_EQUAL(0, cfg_load(put("c5.json", "{\"schema\":\"spm.config/2\"}"), &c, &e));
    TEST_ASSERT_EQUAL_STRING("c5.json: \"schema\" must be \"spm.config/1\"", e.msg);
    TEST_ASSERT_NOT_EQUAL(0, cfg_load("no-such-config.json", &c, &e));
    TEST_ASSERT_EQUAL_STRING("cannot open no-such-config.json", e.msg);
}

/* ---------------------------------------------------------------- U-35.2 tags.json */
static void test_U35_2_demo_tags_load_by_id_with_scale_udt_and_the_studios_crc(void)
{
    TagDB db;
    Err e = {""};
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, tagdb_load(demo("tags.json"), &A, &db, &e), e.msg);
    TEST_ASSERT_EQUAL_UINT16(20, db.n);
    TEST_ASSERT_EQUAL_HEX32(0xD45C7CCE, db.crc); /* = tags_crc of the studio's compiler (golden files) */
    int di = tagdb_find(&db, "DI_S1_PartPresent");
    TEST_ASSERT_EQUAL_INT(9, di); /* id = index in tags.json = what compiled flows use (golden: T:9) */
    TEST_ASSERT_EQUAL_INT(K_DI, db.t[di].kind);
    TEST_ASSERT_EQUAL_INT(D_BOOL, db.t[di].dtype);
    TEST_ASSERT_EQUAL_UINT16(3, db.t[di].addr.slave);
    TEST_ASSERT_EQUAL_INT16(0, db.t[di].addr.ch);
    TEST_ASSERT_EQUAL_INT(-1, tagdb_find(&db, "DI_S1_Nothing"));
    const Tag *ai = &db.t[tagdb_find(&db, "AI_Sealer_Temp")]; /* raw 0 … 32767 → 0 … 400 degC */
    TEST_ASSERT_FLOAT_WITHIN(1e-6f, 400.0f / 32767.0f, ai->k);
    TEST_ASSERT_FLOAT_WITHIN(1e-6f, 0.0f, ai->o);
    const Tag *cy = &db.t[tagdb_find(&db, "CY_S1_Clamp")];
    TEST_ASSERT_EQUAL_STRING("Cylinder", cy->udt_type);
    TEST_ASSERT_EQUAL_UINT8(3, cy->n_fields);
    TEST_ASSERT_EQUAL_STRING("out", cy->fields[0].name);
    TEST_ASSERT_EQUAL_INT(tagdb_find(&db, "DO_S1_ClampValve"), cy->fields[0].tag);
    TEST_ASSERT_TRUE(db.t[tagdb_find(&db, "C_ShiftGood")].flags & F_RETAIN);
}

static void expect_tag_error(const char *json, const char *msg)
{
    TagDB db;
    Err e = {""};
    TEST_ASSERT_NOT_EQUAL(0, tagdb_load(put("t.json", json), &A, &db, &e));
    TEST_ASSERT_EQUAL_STRING(msg, e.msg);
}

static void test_U35_3_tag_mistakes_are_refused_with_the_tag_and_the_reason(void)
{
    expect_tag_error("{\"schema\":\"spm.tags/1\",\"tags\":[{\"name\":\"A\",\"kind\":\"DX\",\"dtype\":\"BOOL\"}]}",
                     "t.json: tag 0 \"A\": unknown kind \"DX\"");
    expect_tag_error("{\"schema\":\"spm.tags/1\",\"tags\":[{\"name\":\"A\",\"kind\":\"REG\",\"dtype\":\"INT\"},{\"name\":\"A\",\"kind\":\"REG\",\"dtype\":\"INT\"}]}",
                     "t.json: tag 1 \"A\": the name is used twice");
    expect_tag_error("{\"schema\":\"spm.tags/1\",\"tags\":[{\"name\":\"DI_X\",\"kind\":\"DI\",\"dtype\":\"BOOL\"}]}", "t.json: DI \"DI_X\" has no address");
    expect_tag_error("{\"schema\":\"spm.tags/1\",\"tags\":[{\"name\":\"CY\",\"kind\":\"UDT\",\"dtype\":\"STRUCT\",\"type\":\"Cylinder\",\"fields\":{\"out\":\"DO_GONE\"}}]}",
                     "t.json: UDT \"CY\": field \"out\" names \"DO_GONE\", which is not a tag");
    expect_tag_error("{\"schema\":\"spm.tags/2\",\"tags\":[]}", "t.json: \"schema\" must be \"spm.tags/1\"");
    expect_tag_error("{\"schema\":\"spm.tags/1\",\"tags\":[}", "t.json is not valid JSON (near: })");
}

/* ---------------------------------------------------------------- U-35.4 SimCard */
static void test_U35_4_simcard_cylinder_sensors_follow_the_valve_after_200_ms(void)
{
    RtConfig c;
    TagDB db;
    Card card;
    IoMap io;
    Err e = {""};
    TEST_ASSERT_EQUAL_INT(0, cfg_load(demo("config.json"), &c, &e));
    TEST_ASSERT_EQUAL_INT(0, tagdb_load(demo("tags.json"), &A, &db, &e));
    TEST_ASSERT_EQUAL_INT(0, card_open(&card, &c, &e));
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, io_map_bind(&db, &card, &A, &io, &e), e.msg);
    TEST_ASSERT_EQUAL_UINT16(5, io.n_in);  /* 4 DI + 1 AI */
    TEST_ASSERT_EQUAL_UINT16(4, io.n_out); /* 3 DO + 1 AO */
    Tag *valve = &db.t[tagdb_find(&db, "DO_S1_ClampValve")];
    Tag *open = &db.t[tagdb_find(&db, "DI_S1_ClampOpen")], *closed = &db.t[tagdb_find(&db, "DI_S1_ClampClosed")];
    io_read_inputs(&db, &card, &io, 0);
    TEST_ASSERT_EQUAL_UINT8(1, open->v.b); /* valve off: the cylinder is open */
    TEST_ASSERT_EQUAL_UINT8(0, closed->v.b);
    valve->v.b = 1; /* the program closes it */
    io_write_outputs(&db, &card, &io);
    for (int ms = 0; ms < 199; ms++) card.vt->read_inputs(&card, 1000);
    io_read_inputs(&db, &card, &io, 199);
    TEST_ASSERT_EQUAL_UINT8(0, open->v.b); /* moving: neither end sensor */
    TEST_ASSERT_EQUAL_UINT8(0, closed->v.b);
    card.vt->read_inputs(&card, 1000);
    io_read_inputs(&db, &card, &io, 200);
    TEST_ASSERT_EQUAL_UINT8(1, closed->v.b); /* after 200 ms: closed */
    TEST_ASSERT_EQUAL_UINT32(200, closed->t_change);
    /* an axis moves at its speed */
    TEST_ASSERT_EQUAL_INT(0, card.vt->move_abs(&card, 1, 100.0, 500.0));
    for (int ms = 0; ms < 100; ms++) card.vt->axes_update(&card, 1000);
    TEST_ASSERT_DOUBLE_WITHIN(1e-6, 50.0, card.ax[1].pos);
    for (int ms = 0; ms < 101; ms++) card.vt->axes_update(&card, 1000);
    TEST_ASSERT_TRUE(card.ax[1].in_pos);
    /* outputs to safe on stop */
    io_all_safe(&db, &card, &io);
    TEST_ASSERT_EQUAL_UINT8(0, card.dout[valve->io]);
    card_close(&card);
}

static void test_U35_5_io_map_refuses_a_channel_twice_and_addresses_the_card_does_not_have(void)
{
    RtConfig c;
    TagDB db;
    Card card;
    IoMap io;
    Err e = {""};
    TEST_ASSERT_EQUAL_INT(0, cfg_load(put("c_min.json", "{\"schema\":\"spm.config/1\"}"), &c, &e));
    TEST_ASSERT_EQUAL_INT(0, tagdb_load(put("t2.json", "{\"schema\":\"spm.tags/1\",\"tags\":["
                                                     "{\"name\":\"DI_A\",\"kind\":\"DI\",\"dtype\":\"BOOL\",\"addr\":{\"bus\":\"ecat\",\"slave\":3,\"ch\":1}},"
                                                     "{\"name\":\"DI_B\",\"kind\":\"DI\",\"dtype\":\"BOOL\",\"addr\":{\"bus\":\"ecat\",\"slave\":3,\"ch\":1}}]}"),
                                            &A, &db, &e));
    TEST_ASSERT_EQUAL_INT(0, card_open(&card, &c, &e));
    TEST_ASSERT_NOT_EQUAL(0, io_map_bind(&db, &card, &A, &io, &e));
    TEST_ASSERT_EQUAL_STRING("tags \"DI_A\" and \"DI_B\" use the same DI channel", e.msg);
    TEST_ASSERT_EQUAL_INT(0, tagdb_load(put("t3.json", "{\"schema\":\"spm.tags/1\",\"tags\":["
                                                     "{\"name\":\"DI_C\",\"kind\":\"DI\",\"dtype\":\"BOOL\",\"addr\":{\"bus\":\"ecat\",\"slave\":3,\"ch\":20}}]}"),
                                            &A, &db, &e));
    TEST_ASSERT_NOT_EQUAL(0, io_map_bind(&db, &card, &A, &io, &e));
    TEST_ASSERT_EQUAL_STRING("tag \"DI_C\": SimCard has slaves 0 … 63 with channels 0 … 15 (slave 3 ch 20)", e.msg);
}

/* ---------------------------------------------------------------- U-35.6 jitter statistics */
static void test_U35_6_jitter_stats_period_jitter_lateness_exec_overruns_histogram(void)
{
    CycleStats s;
    stats_init(&s, 1000);
    /* deadlines every 1000 µs; starts a little off; bodies of 5 µs, one of 1200 µs (an overrun) */
    const uint64_t dl[] = {1000, 2000, 3000, 4000, 5000}, st[] = {1000, 2008, 2990, 4300, 5000}, ex[] = {5, 5, 5, 1200, 5};
    for (int i = 0; i < 5; i++) stats_cycle(&s, dl[i], st[i], st[i] + ex[i]);
    const CycleWin *w = &s.total;
    TEST_ASSERT_EQUAL_UINT64(5, w->n);
    TEST_ASSERT_EQUAL_UINT32(700, w->per_min); /* 4300 → 5000 */
    TEST_ASSERT_EQUAL_UINT32(1310, w->per_max); /* 2990 → 4300 */
    TEST_ASSERT_EQUAL_UINT32(310, w->jit_max);
    TEST_ASSERT_EQUAL_UINT32(300, w->late_max);
    TEST_ASSERT_EQUAL_UINT32(1200, w->exec_max);
    TEST_ASSERT_EQUAL_UINT64(1, w->overruns);
    TEST_ASSERT_EQUAL_UINT64(1, w->hist[0]); /* |1008−1000| = 8 */
    TEST_ASSERT_EQUAL_UINT64(1, w->hist[1]); /* 18 */
    TEST_ASSERT_EQUAL_UINT64(2, w->hist[4]); /* 310, 300 */
    TEST_ASSERT_DOUBLE_WITHIN(1e-9, 1000.0, stats_avg(w));
    char line[512];
    stats_line(w, line, sizeof line);
    TEST_ASSERT_EQUAL_STRING("cycles 5  period 700..1310 us (avg 1000.0)  jitter max 310 us  late max 300 us  exec max 1200 us  overruns 1  "
                             "[<=10:1 <=50:1 <=100:0 <=250:0 <=500:2 >500:0]",
                             line);
}

/* ---------------------------------------------------------------- U-35.7 the RT thread */
static volatile uint32_t g_calls;
static CycleStats g_st;
static void count_cycle(void *user, uint64_t deadline, uint64_t start)
{
    (void)user;
    g_calls++;
    stats_cycle(&g_st, deadline, start, os_now_us());
}
static void test_U35_7_rt_thread_runs_the_cycle_every_period_and_hands_over_stats(void)
{
    OsRt rt;
    Err e = {""};
    memset(&rt, 0, sizeof rt);
    rt.period_us = 1000;
    rt.spin_us = 200;
    rt.cpu = -1;
    rt.cycle = count_cycle;
    stats_init(&g_st, 1000);
    g_calls = 0;
    TEST_ASSERT_EQUAL_INT(0, os_rt_start(&rt, &e));
    os_sleep_ms(300);
    CycleWin w;
    memset(&w, 0, sizeof w);
    TEST_ASSERT_EQUAL_INT_MESSAGE(0, stats_take(&g_st, &w, 1000), "the RT thread handed over its window");
    os_sleep_ms(200);
    os_rt_stop(&rt);
    /* 500 ms at 1 ms: about 500 cycles — generous limits, CI machines are busy */
    TEST_ASSERT_TRUE_MESSAGE(g_calls >= 250 && g_calls <= 520, "cycles in 500 ms");
    TEST_ASSERT_TRUE(w.n >= 150);
    TEST_ASSERT_TRUE(rt.prio_note[0] != 0);
    TEST_ASSERT_EQUAL_UINT64(g_calls, g_st.total.n);
}

#include "test_link.c"
#include "test_flow.c"

int main(void)
{
    const char *env = getenv("SPM_PROJECTS");
    snprintf(g_demo, sizeof g_demo, "%s", env && env[0] ? env : SPM_PROJECTS_DIR);
    UNITY_BEGIN();
    RUN_TEST(test_U35_1_config_loads_with_defaults_and_refuses_mistakes);
    RUN_TEST(test_U35_2_demo_tags_load_by_id_with_scale_udt_and_the_studios_crc);
    RUN_TEST(test_U35_3_tag_mistakes_are_refused_with_the_tag_and_the_reason);
    RUN_TEST(test_U35_4_simcard_cylinder_sensors_follow_the_valve_after_200_ms);
    RUN_TEST(test_U35_5_io_map_refuses_a_channel_twice_and_addresses_the_card_does_not_have);
    RUN_TEST(test_U35_6_jitter_stats_period_jitter_lateness_exec_overruns_histogram);
    RUN_TEST(test_U35_7_rt_thread_runs_the_cycle_every_period_and_hands_over_stats);
    RUN_TEST(test_U36_1_decode_ping_commands_and_mistakes);
    RUN_TEST(test_U36_2_encode_the_same_json_as_the_mock_runtime);
    RUN_TEST(test_U36_3_packml_table_and_texts_are_the_studios);
    RUN_TEST(test_U36_4_alarm_list_rule_raise_ack_clear);
    RUN_TEST(test_U36_5_machine_commands_acting_states_alarm_demo_download_ack);
    RUN_TEST(test_U36_6_download_check_crc_of_the_studios_file);
    RUN_TEST(test_U36_7_queue_ring_and_triple_buffer);
    RUN_TEST(test_U36_8_websocket_round_trip_connect_ping_command_download);
    RUN_TEST(test_U37_1_axes_points_and_alarms_from_tags_json);
    RUN_TEST(test_U37_2_step_table_from_the_demo_and_what_it_refuses);
    RUN_TEST(test_U37_3_rpn_gives_what_the_studios_evalRpn_gives);
    RUN_TEST(test_U37_4_each_op_handler_on_the_simcard);
    RUN_TEST(test_U37_5_the_demo_flow_runs_1000_cycles_on_the_simcard);
    RUN_TEST(test_U37_6_stop_is_instant_hold_resumes_the_move);
    RUN_TEST(test_U37_7_program_at_start_up_missing_or_refused);
    RUN_TEST(test_U37_8_pc_in_state_frames_and_step_events);
    return UNITY_END();
}

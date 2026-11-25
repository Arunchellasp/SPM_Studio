/*
 * SimCard (design: 'Simulation first — SimCard driver + a simple machine model: cylinder end sensors follow
 * valves after 200 ms, axes move at speed. Whole studio usable on a laptop.')
 * Image index = slave × 16 + channel (slaves 0 … 63, channels 0 … 15). The machine model is built from the
 * project's Cylinder UDTs: fields out (DO), open (DI), closed (DI).
 */
#include <math.h>
#include <string.h>
#include "card.h"

#define SIM_CH 16
#define SIM_SLAVES (CARD_IO_MAX / SIM_CH)
#define SIM_CYL_MAX 64

typedef struct SimCyl {
    int out, open, closed; /* image indices, -1 = not used */
    uint8_t cmd;           /* valve state the sensors are moving to */
    uint32_t t_us;         /* time since the valve changed */
} SimCyl;

typedef struct SimCard {
    uint32_t cyl_us;
    SimCyl cyl[SIM_CYL_MAX];
    int n_cyl;
} SimCard;

static SimCard g_sim; /* one SimCard per process */

static int sim_open(Card *c, const RtConfig *cfg, Err *e)
{
    (void)e;
    memset(&g_sim, 0, sizeof g_sim);
    g_sim.cyl_us = cfg->sim_cyl_ms * 1000u;
    c->impl = &g_sim;
    return 0;
}

static int sim_channel(Card *c, TagKind kind, IoAddr a, Err *e)
{
    (void)c;
    if (kind == K_AXIS) {
        if (a.slave >= CARD_AX_MAX) return err_set(e, -1, "SimCard has axes 0 … %d (slave %u)", CARD_AX_MAX - 1, a.slave);
        return a.slave;
    }
    if (a.slave >= SIM_SLAVES || a.ch < 0 || a.ch >= SIM_CH)
        return err_set(e, -1, "SimCard has slaves 0 … %d with channels 0 … %d (slave %u ch %d)", SIM_SLAVES - 1, SIM_CH - 1, a.slave, a.ch);
    return a.slave * SIM_CH + a.ch;
}

static int field_io(const TagDB *db, const Tag *udt, const char *field, TagKind want, const char **bad)
{
    for (uint8_t f = 0; f < udt->n_fields; f++)
        if (str_eq(udt->fields[f].name, field)) {
            const Tag *t = &db->t[udt->fields[f].tag];
            if (t->kind != want || t->io < 0) {
                *bad = field;
                return -2;
            }
            return t->io;
        }
    return -1;
}

static int sim_bind(Card *c, const TagDB *db, Err *e)
{
    SimCard *s = (SimCard *)c->impl;
    s->n_cyl = 0;
    for (uint16_t i = 0; i < db->n; i++) {
        const Tag *t = &db->t[i];
        if (t->kind != K_UDT || !str_eq(t->udt_type, "Cylinder")) continue;
        if (s->n_cyl >= SIM_CYL_MAX) return err_set(e, 4, "SimCard: more than %d cylinders", SIM_CYL_MAX);
        const char *bad = NULL;
        SimCyl *y = &s->cyl[s->n_cyl];
        y->out = field_io(db, t, "out", K_DO, &bad);
        y->open = field_io(db, t, "open", K_DI, &bad);
        y->closed = field_io(db, t, "closed", K_DI, &bad);
        if (bad) return err_set(e, 4, "SimCard: cylinder \"%s\": field \"%s\" must be a %s with an address", t->name, bad, str_eq(bad, "out") ? "DO" : "DI");
        if (y->out < 0) return err_set(e, 4, "SimCard: cylinder \"%s\" has no field \"out\"", t->name);
        y->cmd = c->dout[y->out];
        y->t_us = s->cyl_us; /* start in the end position of the valve's state */
        if (y->open >= 0) c->di[y->open] = !y->cmd;
        if (y->closed >= 0) c->di[y->closed] = y->cmd;
        s->n_cyl++;
    }
    return 0;
}

/* the machine model: after cyl_us the sensors show the new end position; between them both are off */
static void sim_read_inputs(Card *c, uint32_t dt_us)
{
    SimCard *s = (SimCard *)c->impl;
    for (int i = 0; i < s->n_cyl; i++) {
        SimCyl *y = &s->cyl[i];
        uint8_t v = c->dout[y->out] ? 1 : 0;
        if (v != y->cmd) {
            y->cmd = v;
            y->t_us = 0;
            if (y->open >= 0) c->di[y->open] = 0; /* left the end position */
            if (y->closed >= 0) c->di[y->closed] = 0;
        }
        if (y->t_us < s->cyl_us) {
            y->t_us += dt_us;
            if (y->t_us >= s->cyl_us) {
                if (y->open >= 0) c->di[y->open] = !v;
                if (y->closed >= 0) c->di[y->closed] = v;
            }
        }
    }
}

static void sim_write_outputs(Card *c)
{
    (void)c; /* the outputs stay in the image: the model reads them there */
}

static void sim_axes_update(Card *c, uint32_t dt_us)
{
    for (int i = 0; i < CARD_AX_MAX; i++) {
        CardAxis *a = &c->ax[i];
        if (!a->moving) continue;
        double step = a->vel * (double)dt_us / 1e6, d = a->target - a->pos;
        if (fabs(d) <= step) {
            a->pos = a->target;
            a->moving = 0;
            a->in_pos = 1;
        } else
            a->pos += d > 0 ? step : -step;
    }
}

static int sim_move_abs(Card *c, int axis, double pos, double vel)
{
    if (axis < 0 || axis >= CARD_AX_MAX || vel <= 0) return 1;
    CardAxis *a = &c->ax[axis];
    a->target = pos;
    a->vel = vel;
    a->moving = 1;
    a->in_pos = 0;
    return 0;
}

static void sim_close(Card *c)
{
    c->impl = NULL;
}

const CardVt SIM_CARD = {"SimCard", sim_open, sim_channel, sim_bind, sim_read_inputs, sim_write_outputs, sim_axes_update, sim_move_abs, sim_close};

int card_open(Card *c, const RtConfig *cfg, Err *e)
{
    memset(c, 0, sizeof *c);
    if (str_eq(cfg->card, "sim")) c->vt = &SIM_CARD;
    else return err_set(e, 3, "no driver for card \"%s\"", cfg->card);
    return c->vt->open(c, cfg, e) ? 3 : 0;
}

void card_close(Card *c)
{
    if (c->vt) c->vt->close(c);
}

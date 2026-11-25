/*
 * The card interface (design: IMotionCard — SimCard · GtsCard · AdvantechCard · DeltaCard).
 * A card owns a process image: the RT cycle reads inputs from it and writes outputs into it once per cycle;
 * the driver moves the image to and from the hardware (or, for SimCard, a machine model).
 */
#ifndef SPM_CARD_H
#define SPM_CARD_H

#include <stdint.h>
#include "../data/data_inc.h"

#define CARD_IO_MAX 1024 /* channels per kind (DI, DO, AI, AO) */
#define CARD_AX_MAX 32

typedef struct CardAxis {
    double pos, target, vel; /* engineering units, units / s */
    uint8_t moving, in_pos;
} CardAxis;

struct CardVt;
typedef struct Card {
    const struct CardVt *vt;
    uint8_t di[CARD_IO_MAX], dout[CARD_IO_MAX];
    float ai[CARD_IO_MAX], ao[CARD_IO_MAX]; /* raw values */
    CardAxis ax[CARD_AX_MAX];
    void *impl;
} Card;

typedef struct CardVt {
    const char *name;
    int (*open)(Card *c, const RtConfig *cfg, Err *e);
    /* tag address → index in the process image (axes: axis number), or -1 with the reason in e */
    int (*channel)(Card *c, TagKind kind, IoAddr addr, Err *e);
    /* after io_map_bind: the driver may look at the tags (SimCard builds its machine model from UDTs) */
    int (*bind)(Card *c, const TagDB *db, Err *e);
    void (*read_inputs)(Card *c, uint32_t dt_us);
    void (*write_outputs)(Card *c);
    void (*axes_update)(Card *c, uint32_t dt_us);
    int (*move_abs)(Card *c, int axis, double pos, double vel);
    void (*close)(Card *c);
} CardVt;

int card_open(Card *c, const RtConfig *cfg, Err *e);
void card_close(Card *c);

#endif
